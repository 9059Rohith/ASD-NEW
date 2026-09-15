"""Authenticated, idempotent learning sessions backed by measured vowel evidence."""
from datetime import datetime, timezone
import math
import secrets
from typing import Literal
from uuid import uuid4
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from ..config import settings
from ..database import get_database
from ..services.vowel_progress import BY_TARGET, CATALOG, TARGETS, SUCCESS_THRESHOLD, CELEBRATION_THRESHOLD, load_progress, rewards, session_summary
from ..services.progress_aggregation import refresh_progress_aggregates
from ..utils.jwt_handler import get_current_user
from ..utils.rate_limit import RateLimiter

router = APIRouter(prefix='/api/vowels', tags=['vowels'])
MODES = ('practice', 'evaluate', 'vowel-catch', 'short-or-long', 'match-sound', 'pippin-challenge', 'speed-round', 'vowel-tower')
ALLOWED_AUDIO_TYPES = {'audio/webm', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/3gpp', 'application/octet-stream'}
MAX_ATTEMPTS = 40
audio_rate_limit = RateLimiter(times=30, seconds=60)


class SessionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    mode: Literal['practice', 'evaluate', 'vowel-catch', 'short-or-long', 'match-sound', 'pippin-challenge', 'speed-round', 'vowel-tower']
    target_phoneme: Literal['a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ee', 'o', 'oo'] = 'a'


class AnswerRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    challenge_index: int = Field(ge=0, le=9)
    identity: Literal['A', 'E', 'I', 'O', 'U']
    length: Literal['short', 'long']
    request_id: str = Field(default_factory=lambda: str(uuid4()), min_length=1, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')


def now(): return datetime.now(timezone.utc).isoformat()


def analyze_audio(audio_bytes, target):
    # Keep application startup independent of optional acoustic artifacts.
    from ..services.vowel_analysis import analyze_vowel
    return analyze_vowel(audio_bytes, target)


def public_session(session):
    return {**{key: session[key] for key in ('mode', 'status', 'challenges', 'next_index', 'created_at')},
            'id': session['_id'], 'session_id': session['_id'], 'completed_at': session.get('completed_at')}


async def owned_session(db, session_id, user):
    session = await db.vowel_sessions.find_one({'_id': session_id, 'user_id': str(user['_id'])})
    if session is None: raise HTTPException(404, 'Vowel session not found.')
    return session


def validate_challenge(session, index, target=None):
    if index < 0 or index >= len(session['challenges']): raise HTTPException(422, 'Unknown challenge index.')
    challenge = session['challenges'][index]
    if target is not None and challenge['target_phoneme'] != target:
        raise HTTPException(422, 'Target does not match the server challenge.')
    return challenge


def existing_attempt(session, request_id, index):
    found = next((row for row in session['attempts'] if row['request_id'] == request_id), None)
    if found and found['challenge_index'] != index: raise HTTPException(409, 'Request ID already belongs to another challenge.')
    if found: return found
    if session['mode'] in ('evaluate', 'speed-round', 'match-sound'):
        return next((row for row in session['attempts'] if row['challenge_index'] == index and (row.get('scorable') or row['kind'] == 'listening')), None)
    return None


def validate_open(session, index):
    if session['status'] != 'active': raise HTTPException(409, 'This session is complete. Start a new session.')
    if len(session['attempts']) >= MAX_ATTEMPTS: raise HTTPException(409, 'Session attempt limit reached. Start a new session.')
    minimum = max(0, session['next_index'] - 1) if session['mode'] not in ('evaluate', 'speed-round', 'match-sound') else session['next_index']
    if not minimum <= index <= session['next_index']: raise HTTPException(409, 'Complete challenges in their server order.')
    # Once any recording for a newer challenge exists, an earlier challenge is closed.
    if any(row['challenge_index'] > index for row in session['attempts']): raise HTTPException(409, 'This challenge has already been left.')


async def mirror_evidence(db, user_id, result):
    """Same immutable ID repairs interrupted legacy-report writes on request retry."""
    if not result.get('scorable') or result['kind'] != 'speech': return
    lesson = BY_TARGET[result['target_phoneme']]
    document = {**result, '_id': result['id'], 'user_id': user_id, 'source': 'vowel-studio',
                'lesson_id': lesson['lesson_id'], 'lesson_type': 'letter', 'phoneme': result['target_phoneme'],
                'created_at': datetime.fromisoformat(result['created_at']),
                'phoneme_match': bool(result.get('vowel_analysis', {}).get('identity_match')
                                      and result.get('vowel_analysis', {}).get('length_match'))}
    # Repair the derived legacy flag even for a result mirrored before the
    # identity-and-length rule was applied. Immutable acoustic evidence stays put.
    phoneme_match = document.pop('phoneme_match')
    await db.evaluations.update_one({'_id': document['_id']}, {
        '$setOnInsert': document, '$set': {'phoneme_match': phoneme_match},
    }, upsert=True)
    await refresh_progress_aggregates(db, user_id, lesson['lesson_id'])


async def envelope(db, session, result, already_saved):
    await mirror_evidence(db, session['user_id'], result)
    return {'result': result, 'session_id': session['_id'], 'next_index': session['next_index'],
            'already_saved': already_saved, 'progress': await load_progress(db, session['user_id'])}


async def persist_attempt(db, session, result):
    next_index = max(session['next_index'], result['challenge_index'] + 1) if result.get('scorable') or result['kind'] == 'listening' else session['next_index']
    changes = {'attempts': [*session['attempts'], result], 'next_index': next_index, 'revision': session['revision'] + 1}
    updated = await db.vowel_sessions.update_one({'_id': session['_id'], 'user_id': session['user_id'], 'revision': session['revision'], 'status': 'active'}, {'$set': changes})
    if not updated.modified_count:
        fresh = await db.vowel_sessions.find_one({'_id': session['_id'], 'user_id': session['user_id']})
        existing = existing_attempt(fresh, result['request_id'], result['challenge_index'])
        if existing: return await envelope(db, fresh, existing, True)
        raise HTTPException(409, 'Another recording updated this session. Retry this request.')
    session.update(changes)
    return await envelope(db, session, result, False)


@router.get('/catalog')
async def catalog(_user: dict = Depends(get_current_user)):
    return {'vowels': CATALOG, 'modes': MODES, 'recording_seconds': 7,
            'success_threshold': SUCCESS_THRESHOLD, 'celebration_threshold': CELEBRATION_THRESHOLD}


@router.get('/reference/{target}')
async def reference(target: str, _user: dict = Depends(get_current_user)):
    """Serve only the ten licensed training-speaker examples, never dataset paths."""
    if target not in TARGETS:
        raise HTTPException(404, 'Unknown vowel reference.')
    clip = Path(__file__).resolve().parents[2] / 'models' / 'vowel-classifier' / 'references' / f'{target}.wav'
    if not clip.is_file():
        raise HTTPException(503, 'This listening example is temporarily unavailable.')
    return FileResponse(clip, media_type='audio/wav', headers={'Cache-Control': 'private, max-age=86400'})


@router.post('/sessions', status_code=201)
async def create_session(payload: SessionRequest, user: dict = Depends(get_current_user)):
    targets = [payload.target_phoneme] if payload.mode == 'practice' else list(TARGETS)
    if payload.mode != 'practice': secrets.SystemRandom().shuffle(targets)
    session = {'_id': str(uuid4()), 'user_id': str(user['_id']), 'mode': payload.mode,
               'status': 'active', 'created_at': now(), 'next_index': 0, 'revision': 0, 'attempts': [],
               'challenges': [{**BY_TARGET[target], 'index': index} for index, target in enumerate(targets)]}
    await get_database().vowel_sessions.insert_one(session)
    return public_session(session)


@router.post('/analyze', dependencies=[Depends(audio_rate_limit)])
async def analyze(audio: UploadFile = File(...), target_phoneme: str = Form(..., max_length=2),
                  session_id: str = Form(..., max_length=80), challenge_index: int = Form(..., ge=0, le=9),
                  request_id: str = Form('', max_length=80, pattern=r'^[A-Za-z0-9_-]*$'),
                  debug: bool = Query(False), user: dict = Depends(get_current_user)):
    db = get_database(); session = await owned_session(db, session_id, user)
    validate_challenge(session, challenge_index, target_phoneme)
    if session['mode'] == 'match-sound': raise HTTPException(422, 'Use the listening answer endpoint for Match Sound.')
    request_id = request_id or str(uuid4())
    previous = existing_attempt(session, request_id, challenge_index)
    if previous: return await envelope(db, session, previous, True)
    validate_open(session, challenge_index)
    if audio.content_type and audio.content_type.split(';')[0].strip().lower() not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(415, 'Unsupported audio type.')
    max_bytes = min(settings.MAX_UPLOAD_BYTES, 5 * 1024 * 1024)
    payload = await audio.read(max_bytes + 1)
    if not payload: raise HTTPException(400, 'Empty audio file.')
    if len(payload) > max_bytes: raise HTTPException(413, 'Audio file too large.')
    try:
        measured = await run_in_threadpool(analyze_audio, payload, target_phoneme)
    except (ImportError, FileNotFoundError):
        measured = {'scorable': False, 'accuracy': None, 'validation_status': 'model_unavailable', 'feedback': 'Vowel analysis is temporarily unavailable. Please try again later.'}
    except Exception:
        measured = {'scorable': False, 'accuracy': None, 'validation_status': 'processing_error', 'feedback': 'We could not read this recording. Please record a clear vowel again.'}
    # Whitelist model evidence, never raw features, media, or unexpected internal fields.
    result = {key: measured[key] for key in ('accuracy', 'scorable', 'feedback', 'validation_status', 'vowel_analysis', 'score_components', 'score_method', 'model_version', 'audio_quality') if key in measured}
    score = result.get('accuracy')
    if not result.get('scorable') or not isinstance(score, (float, int)) or not math.isfinite(score) or not 0 <= score <= 100:
        result.update(scorable=False, accuracy=None)
    result.update({'id': str(uuid4()), 'request_id': request_id, 'session_id': session_id,
                   'target_phoneme': target_phoneme, 'challenge_index': challenge_index, 'kind': 'speech', 'created_at': now(),
                   **rewards(result['accuracy'], result.get('vowel_analysis'))})
    response = await persist_attempt(db, session, result)
    if debug and settings.APP_ENV in ('development', 'test') and user.get('role') == 'admin':
        response['result'] = {**response['result'], 'debug_features': measured.get('debug_features', {})}
    return response


@router.post('/sessions/{session_id}/answer')
async def answer(session_id: str, payload: AnswerRequest, user: dict = Depends(get_current_user)):
    db = get_database(); session = await owned_session(db, session_id, user)
    if session['mode'] != 'match-sound': raise HTTPException(422, 'Listening answers belong to Match Sound sessions.')
    challenge = validate_challenge(session, payload.challenge_index)
    previous = existing_attempt(session, payload.request_id, payload.challenge_index)
    if previous: return await envelope(db, session, previous, True)
    validate_open(session, payload.challenge_index)
    correct = payload.identity == challenge['identity'] and payload.length == challenge['length']
    result = {'id': str(uuid4()), 'request_id': payload.request_id, 'session_id': session_id,
              'kind': 'listening', 'challenge_index': payload.challenge_index, 'target_phoneme': challenge['target_phoneme'],
              'identity': payload.identity, 'length': payload.length, 'correct': correct, 'scorable': False, 'accuracy': None,
              'target_identity': challenge['identity'], 'target_length': challenge['length'],
              'created_at': now(), 'feedback': 'You matched the sound!' if correct else 'Listen once more and compare the vowel and its length.'}
    return await persist_attempt(db, session, result)


@router.post('/sessions/{session_id}/complete')
async def complete(session_id: str, user: dict = Depends(get_current_user)):
    db = get_database(); session = await owned_session(db, session_id, user)
    summary = session_summary(session)
    if session['next_index'] != len(session['challenges']) or summary['challenge_count'] != len(session['challenges']):
        raise HTTPException(409, 'Finish every challenge before completing this session.')
    if session['mode'] in ('evaluate', 'speed-round') and set(row['target_phoneme'] for row in summary['results']) != set(TARGETS):
        raise HTTPException(409, 'Evaluation requires every canonical vowel class.')
    if session['status'] != 'completed':
        changes = {'status': 'completed', 'completed_at': now(), 'revision': session['revision'] + 1}
        updated = await db.vowel_sessions.update_one({'_id': session_id, 'user_id': session['user_id'], 'revision': session['revision'], 'status': 'active'}, {'$set': changes})
        if not updated.modified_count: raise HTTPException(409, 'Session changed. Retry completion.')
        session.update(changes)
    for row in session['attempts']: await mirror_evidence(db, session['user_id'], row)
    return {'session': public_session(session), 'summary': summary, 'progress': await load_progress(db, session['user_id'])}


@router.get('/sessions')
async def history(limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0, le=10000), user: dict = Depends(get_current_user)):
    sessions = await get_database().vowel_sessions.find({'user_id': str(user['_id'])}).sort('created_at', -1).skip(offset).limit(limit).to_list(length=limit)
    return {'sessions': [{**public_session(row), 'summary': session_summary(row)} for row in sessions]}


@router.get('/progress')
async def progress(user: dict = Depends(get_current_user)):
    return await load_progress(get_database(), str(user['_id']))
