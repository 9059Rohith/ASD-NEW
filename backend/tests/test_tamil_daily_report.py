from datetime import date
from io import BytesIO

from pypdf import PdfReader

from app.services.tamil_daily_report import day_window, render_pdf, summarize_day
from app.routers.tamil_reports import ReportConfig, provider_ready, validate_config


def test_timezone_day_window_is_local_midnight_not_utc_midnight():
    start, end = day_window(date(2026, 9, 14), 'Asia/Kolkata')
    assert start.startswith('2026-09-13T18:30:00')
    assert end.startswith('2026-09-14T18:30:00')


def test_daily_report_excludes_unscored_speech_and_embeds_readable_tamil():
    attempts = [
        {'kind': 'word', 'item_id': 'word-amma', 'mode': 'audio', 'correct': False,
         'scorable': False, 'accuracy': None},
        {'kind': 'word', 'item_id': 'word-amma', 'mode': 'recognition', 'correct': True,
         'scorable': False, 'accuracy': None},
        {'kind': 'vowel', 'item_id': 'letter-a', 'mode': 'audio', 'correct': True,
         'scorable': True, 'accuracy': 92.0},
    ]
    games = [{'game_slug': 'letter-match', 'item_id': 'letter-a', 'correct': True}]
    summary = summarize_day(date(2026, 9, 14), 'Asia/Kolkata', attempts, games)
    assert summary['by_kind']['word']['speech_average'] is None
    assert summary['by_kind']['word']['unscored_speech'] == 1
    assert summary['by_kind']['vowel']['speech_average'] == 92
    assert summary['by_game']['letter-match'] == {'attempts': 1, 'correct': 1}
    pdf = render_pdf(summary, 'Test Child')
    reader = PdfReader(BytesIO(pdf))
    assert pdf.startswith(b'%PDF-')
    assert 'அம்மா' in reader.pages[0].extract_text()
    assert 'not a diagnosis' in reader.pages[-1].extract_text()


def test_delivery_needs_real_provider_credentials_and_explicit_consent():
    assert provider_ready('email') is False
    assert provider_ready('whatsapp') is False
    config = ReportConfig(doctor_name='Dr Example', doctor_email='doctor@example.com',
                          channel='email', consent=False, enabled=False)
    validate_config(config)
    config.enabled = True
    try:
        validate_config(config)
        assert False, 'Missing consent must be rejected'
    except Exception as error:
        assert getattr(error, 'status_code', None) == 422
