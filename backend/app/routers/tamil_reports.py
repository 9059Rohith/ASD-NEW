"""Consented clinician PDF previews and idempotent daily delivery."""
import asyncio
import re
import smtplib
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from uuid import uuid5, NAMESPACE_URL
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from bson import Binary
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from ..config import settings
from ..database import get_database
from ..services.tamil_daily_report import collect_day, render_pdf
from ..services.tamil_agents import run_learning_pipeline
from ..utils.jwt_handler import get_current_user

router = APIRouter(prefix='/api/tamil-reports', tags=['tamil-reports'])
PHONE = re.compile(r'^\+?[1-9]\d{7,14}$')


class ReportConfig(BaseModel):
    doctor_name: str = Field(min_length=2, max_length=100)
    doctor_email: EmailStr | None = None
    doctor_phone: str | None = None
    channel: str = Field(pattern='^(email|whatsapp)$')
    timezone: str = 'Asia/Kolkata'
    enabled: bool = False
    consent: bool = False


def provider_ready(channel: str) -> bool:
    if channel == 'email':
        return all((settings.SMTP_HOST, settings.SMTP_USERNAME, settings.SMTP_PASSWORD, settings.SMTP_FROM))
    if channel == 'whatsapp':
        return all((settings.WHATSAPP_PHONE_ID, settings.WHATSAPP_ACCESS_TOKEN,
                    settings.WHATSAPP_TEMPLATE_NAME, settings.WHATSAPP_GRAPH_VERSION))
    return False


def public_config(row: dict | None) -> dict:
    if not row:
        return {'enabled': False, 'consent': False, 'delivery_status': 'Not configured'}
    return {key: row.get(key) for key in ('doctor_name', 'doctor_email', 'doctor_phone',
                                          'channel', 'timezone', 'enabled', 'consent', 'consent_at')} | {
        'provider_ready': provider_ready(row.get('channel', '')),
        'delivery_status': 'Ready' if row.get('enabled') and provider_ready(row.get('channel', '')) else 'Not configured'}


def validate_config(config: ReportConfig):
    try:
        ZoneInfo(config.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(422, 'Choose a valid IANA timezone.')
    if config.doctor_phone and not PHONE.fullmatch(config.doctor_phone):
        raise HTTPException(422, 'Doctor phone must be in international format.')
    if config.enabled and not config.consent:
        raise HTTPException(422, 'Caregiver consent is required before delivery can be enabled.')
    if config.enabled and config.channel == 'email' and not config.doctor_email:
        raise HTTPException(422, 'A doctor email address is required for email delivery.')
    if config.enabled and config.channel == 'whatsapp' and not config.doctor_phone:
        raise HTTPException(422, 'A doctor phone number is required for WhatsApp delivery.')


async def _send_email(config: dict, pdf: bytes, day: date):
    message = EmailMessage()
    message['Subject'] = f"Tamil learning report - {day.isoformat()}"
    message['From'] = settings.SMTP_FROM
    message['To'] = config['doctor_email']
    message.set_content('A caregiver-authorized Tamil learning report is attached. This educational report is not a diagnosis.')
    message.add_attachment(pdf, maintype='application', subtype='pdf', filename=f"tamil-learning-{day.isoformat()}.pdf")

    def deliver():
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as client:
            client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            client.send_message(message)
    await asyncio.to_thread(deliver)
    return {'provider': 'smtp', 'state': 'accepted'}


async def _send_whatsapp(config: dict, pdf: bytes, day: date):
    root = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{settings.WHATSAPP_PHONE_ID}"
    headers = {'Authorization': f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}'}
    async with httpx.AsyncClient(timeout=25) as client:
        upload = await client.post(f'{root}/media', headers=headers,
                                   data={'messaging_product': 'whatsapp'},
                                   files={'file': (f'tamil-learning-{day.isoformat()}.pdf', pdf, 'application/pdf')})
        upload.raise_for_status()
        media_id = upload.json()['id']
        payload = {'messaging_product': 'whatsapp', 'to': config['doctor_phone'].lstrip('+'),
                   'type': 'template', 'template': {'name': settings.WHATSAPP_TEMPLATE_NAME,
                   'language': {'code': settings.WHATSAPP_TEMPLATE_LANGUAGE},
                   'components': [{'type': 'header', 'parameters': [{'type': 'document',
                   'document': {'id': media_id, 'filename': f'tamil-learning-{day.isoformat()}.pdf'}}]}]}}
        send = await client.post(f'{root}/messages', headers=headers, json=payload)
        send.raise_for_status()
        message_id = send.json().get('messages', [{}])[0].get('id')
    return {'provider': 'whatsapp_cloud_api', 'state': 'accepted', 'message_id': message_id}


async def dispatch_daily(db, config: dict, day: date, *, manual_retry: bool = False) -> dict:
    """Claim one report per child, channel and day before any provider call."""
    if not config.get('enabled') or not config.get('consent') or not provider_ready(config.get('channel', '')):
        return {'status': 'not_configured'}
    user_id = config['user_id']
    recipient = config.get('doctor_email') if config['channel'] == 'email' else config.get('doctor_phone')
    report_id = str(uuid5(NAMESPACE_URL, f"tamil-daily:{user_id}:{config['channel']}:{recipient}:{day.isoformat()}:v1"))
    existing = await db.tamil_daily_reports.find_one({'_id': report_id})
    if existing and not (manual_retry and existing.get('status') == 'needs_review'):
        return {'status': existing['status'], 'day': day.isoformat(), 'already_created': True}
    if existing:
        changed = await db.tamil_daily_reports.update_one({'_id': report_id, 'status': 'needs_review'},
                                                           {'$set': {'status': 'sending', 'retry_at': datetime.now(timezone.utc)}})
        if not changed.modified_count:
            return {'status': 'sending', 'already_created': True}
        pdf = bytes(existing['pdf'])
    else:
        summary = await collect_day(db, user_id, day, config['timezone'])
        from .tamil import load_progress
        agents = run_learning_pipeline(await load_progress(db, user_id), report_config=config,
                                       delivery_provider_ready=True)
        summary['trace_id'] = agents['trace_id']
        summary['cumulative_learning'] = agents['report']['educational_summary']
        summary['next_step_item_id'] = agents['report']['next_step_item_id']
        pdf = render_pdf(summary, config.get('child_name') or 'Child')
        doc = {'_id': report_id, 'user_id': user_id, 'day': day.isoformat(),
               'channel': config['channel'], 'recipient': recipient,
               'summary': summary, 'pdf': Binary(pdf), 'status': 'sending',
               'created_at': datetime.now(timezone.utc), 'attempts': 1}
        try:
            await db.tamil_daily_reports.insert_one(doc)
        except DuplicateKeyError:
            return {'status': 'sending', 'already_created': True}
    try:
        outcome = await (_send_email(config, pdf, day) if config['channel'] == 'email' else _send_whatsapp(config, pdf, day))
    except Exception as exc:
        # Provider errors may have occurred after acceptance; never retry automatically.
        await db.tamil_daily_reports.update_one({'_id': report_id}, {'$set': {
            'status': 'needs_review', 'error_type': type(exc).__name__, 'failed_at': datetime.now(timezone.utc)}})
        return {'status': 'needs_review', 'day': day.isoformat()}
    await db.tamil_daily_reports.update_one({'_id': report_id}, {'$set': {
        'status': 'accepted', 'provider': outcome['provider'], 'provider_message_id': outcome.get('message_id'),
        'accepted_at': datetime.now(timezone.utc)}})
    return {'status': 'accepted', 'day': day.isoformat(), 'provider': outcome['provider']}


async def run_due_reports(db, moment: datetime | None = None):
    current = moment or datetime.now(timezone.utc)
    configs = await db.tamil_report_configs.find({'enabled': True, 'consent': True}).to_list(length=10000)
    for config in configs:
        try:
            local = current.astimezone(ZoneInfo(config['timezone']))
            if local.hour >= 7 and provider_ready(config['channel']):
                await dispatch_daily(db, config, local.date() - timedelta(days=1))
        except Exception:
            # One broken recipient does not prevent other children from receiving their reports.
            continue


@router.get('/config')
async def get_config(user: dict = Depends(get_current_user)):
    return public_config(await get_database().tamil_report_configs.find_one({'user_id': str(user['_id'])}))


@router.put('/config')
async def put_config(payload: ReportConfig, user: dict = Depends(get_current_user)):
    if user.get('role') not in {'user', 'admin'}:
        raise HTTPException(403, 'Only a caregiver can configure a child report.')
    validate_config(payload)
    db = get_database()
    user_id = str(user['_id'])
    previous = await db.tamil_report_configs.find_one({'user_id': user_id})
    values = payload.model_dump()
    values.update(user_id=user_id, child_name=user.get('child_name') or 'Child',
                  consent_at=datetime.now(timezone.utc).isoformat() if payload.consent else None,
                  updated_at=datetime.now(timezone.utc))
    if previous and any(previous.get(field) != values.get(field) for field in ('doctor_email', 'doctor_phone', 'channel')):
        values['enabled'] = False
        values['consent'] = False
        values['consent_at'] = None
    await db.tamil_report_configs.update_one({'user_id': user_id}, {'$set': values}, upsert=True)
    return public_config(values)


@router.get('/preview')
async def preview(day: date | None = None, user: dict = Depends(get_current_user)):
    db = get_database()
    config = await db.tamil_report_configs.find_one({'user_id': str(user['_id'])})
    zone = (config or {}).get('timezone', 'Asia/Kolkata')
    selected_day = day or datetime.now(ZoneInfo(zone)).date() - timedelta(days=1)
    summary = await collect_day(db, str(user['_id']), selected_day, zone)
    from .tamil import load_progress
    agents = run_learning_pipeline(await load_progress(db, str(user['_id'])), report_config=config,
                                   delivery_provider_ready=provider_ready(config.get('channel', '')) if config else False)
    summary['trace_id'] = agents['trace_id']
    summary['cumulative_learning'] = agents['report']['educational_summary']
    summary['next_step_item_id'] = agents['report']['next_step_item_id']
    return summary


@router.get('/pdf')
async def pdf(day: date | None = None, user: dict = Depends(get_current_user)):
    summary = await preview(day, user)
    data = render_pdf(summary, user.get('child_name') or 'Child')
    return Response(content=data, media_type='application/pdf', headers={
        'Content-Disposition': f"attachment; filename=tamil-learning-{summary['day']}.pdf"})


@router.get('/history')
async def history(user: dict = Depends(get_current_user)):
    rows = await get_database().tamil_daily_reports.find({'user_id': str(user['_id'])},
        {'pdf': 0, 'summary': 0, 'recipient': 0}).sort('day', -1).limit(90).to_list(length=90)
    return {'reports': [{'day': row['day'], 'channel': row['channel'], 'status': row['status'],
                         'accepted_at': row.get('accepted_at').isoformat() if row.get('accepted_at') else None}
                        for row in rows]}


@router.post('/send/{day}')
async def manual_send(day: date, user: dict = Depends(get_current_user)):
    db = get_database()
    config = await db.tamil_report_configs.find_one({'user_id': str(user['_id'])})
    if not config or not config.get('enabled') or not config.get('consent'):
        raise HTTPException(409, 'Set a doctor recipient and enable consent before sending.')
    if day > datetime.now(ZoneInfo(config['timezone'])).date():
        raise HTTPException(422, 'Cannot report a future day.')
    return await dispatch_daily(db, config, day, manual_retry=True)
