"""Bounded Tamil practice with vowel identity and non-clinical phoneme scores."""
from datetime import datetime, timedelta, timezone
import math
from typing import Annotated
from uuid import UUID, uuid5, NAMESPACE_URL

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from starlette.concurrency import run_in_threadpool

from ..config import settings
from ..database import get_database
from ..tamil_curriculum import BY_ID, TAMIL_CATALOG
from ..services.indicconformer import IndicConformerUnavailable, indicconformer_service
from ..services.tamil_validation import grade_tamil_transcript, normalize_written_tamil
from ..services.tamil_agents import run_learning_pipeline
from ..utils.jwt_handler import get_current_user
from ..utils.rate_limit import RateLimiter

router = APIRouter(prefix='/api/tamil', tags=['tamil'])
audio_rate_limit = RateLimiter(times=30, seconds=60)
answer_rate_limit = RateLimiter(times=60, seconds=60)
ALLOWED_AUDIO_TYPES = {'audio/webm', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg',
                       'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/3gpp', 'application/octet-stream'}
RESULT_FIELDS = ('accuracy', 'scorable', 'phoneme_match', 'confidence', 'feedback', 'validation_status',
                  'validation_source', 'expected_phonemes', 'actual_phonemes', 'correct_phonemes',
                  'total_phonemes', 'edit_distance', 'score_method', 'model_id', 'model_version',
                  'active_duration_ms', 'detected_vowel', 'correct', 'recognized_text', 'text_similarity')
QUALITY_FIELDS = ('duration_seconds', 'active_duration_seconds', 'rms', 'peak', 'clipping_ratio', 'has_speech', 'warnings')
RECOGNITION_MASTERY_THRESHOLD = 3
REVIEW_INTERVAL_DAYS = (1, 3, 7, 14, 30)


def review_schedule(item_group, now):
    """Return a review date from persisted attempts, with misses due immediately."""
    last_at = item_group.get('last_at')
    if not last_at:
        return None
    try:
        latest = datetime.fromisoformat(last_at.replace('Z', '+00:00')).astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None
    last_wrong_at = item_group.get('last_wrong_at')
    interval = REVIEW_INTERVAL_DAYS[min(max(item_group['correct_attempts'] - 1, 0), len(REVIEW_INTERVAL_DAYS) - 1)]
    if last_wrong_at and last_wrong_at >= last_at:
        interval = 0
    due_at = latest + timedelta(days=interval)
    return {'due_at': due_at.isoformat(), 'due': now >= due_at, 'interval_days': interval}


def evaluate_audio(payload, target):
    if target in {'ai', 'au'}:
        from ..services.diphthong_analysis import analyze_diphthong
        return analyze_diphthong(payload, target)
    if target in {'a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ee', 'o', 'oo'}:
        from ..services.vowel_analysis import analyze_vowel
        return analyze_vowel(payload, target)
    from ..services.phoneme_pipeline import phoneme_evaluator
    return phoneme_evaluator.evaluate_pronunciation(payload, target)


def transcribe_tamil(payload):
    return indicconformer_service.transcribe(payload)


def evaluate_item_audio(payload, item, browser_transcript=''):
    if not item['can_evaluate']:
        return {'scorable': False, 'accuracy': None, 'phoneme_match': False,
                'validation_status': 'unsupported_target',
                'feedback': 'Pronunciation scoring is not available for this letter. Try the recognition activity.'}
    if item['kind'] in {'word', 'sentence'}:
        acoustic = None
        if str(browser_transcript or '').strip():
            acoustic = evaluate_audio(payload, item['phoneme_target'])
            if acoustic.get('audio_quality', {}).get('has_speech') is True:
                measured = grade_tamil_transcript(item, browser_transcript)
                measured['validation_source'] = 'browser_tamil_speech_recognition'
                measured['audio_quality'] = acoustic['audio_quality']
                return measured
            if acoustic.get('validation_status') in {'no_speech', 'invalid_audio'}:
                return acoustic
        try:
            recognized = transcribe_tamil(payload)
        except IndicConformerUnavailable:
            return acoustic or evaluate_audio(payload, item['phoneme_target'])
        if recognized:
            return grade_tamil_transcript(item, recognized)
        return acoustic or evaluate_audio(payload, item['phoneme_target'])
    return evaluate_audio(payload, item['phoneme_target'])


def safe_result(measured):
    """Keep acoustic evidence only, including whitelists inside nested records."""
    result = {key: measured[key] for key in RESULT_FIELDS if key in measured}
    for key in ('phoneme_alignment', 'phoneme_errors'):
        if key in measured:
            result[key] = [{k: row[k] for k in ('expected', 'actual', 'operation') if k in row}
                           for row in measured[key]]
    if 'phoneme_segments' in measured:
        result['phoneme_segments'] = [{k: row[k] for k in ('phoneme', 'start_seconds', 'end_seconds', 'confidence') if k in row}
                                     for row in measured['phoneme_segments']]
    for key in ('vowel_analysis', 'score_components'):
        if key in measured and isinstance(measured[key], dict):
            result[key] = measured[key]
    if 'audio_quality' in measured:
        result['audio_quality'] = {k: measured['audio_quality'][k] for k in QUALITY_FIELDS if k in measured['audio_quality']}
    score = result.get('accuracy')
    if not result.get('scorable') or type(score) not in (float, int) or not math.isfinite(score) or not 0 <= score <= 100:
        result.update(scorable=False, accuracy=None, correct=False)
    confidence = result.get('confidence')
    if type(confidence) not in (int, float) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
        result['confidence'] = None
    return result


def public_attempt(row):
    return {key: value for key, value in row.items() if key not in ('_id', 'user_id')}


async def load_progress(db, user_id):
    # Aggregate the entire history in Mongo; never fetch an unbounded history.
    kinds = ('vowel', 'consonant', 'aytham', 'uyirmei', 'word', 'sentence')
    groups = await (await db.tamil_attempts.aggregate([
        {'$match': {'user_id': user_id}},
        {'$group': {'_id': '$kind', 'attempts': {'$sum': 1},
                    'recognition_attempts': {'$sum': {'$cond': [{'$eq': ['$mode', 'recognition']}, 1, 0]}},
                    'recognition_correct': {'$sum': {'$cond': [{'$and': [{'$eq': ['$mode', 'recognition']}, '$correct']}, 1, 0]}},
                    'scored_attempts': {'$sum': {'$cond': ['$scorable', 1, 0]}},
                    'score_sum': {'$sum': {'$cond': ['$scorable', '$accuracy', 0]}},
                    'average_score': {'$avg': {'$cond': ['$scorable', '$accuracy', None]}},
                    'completed_items': {'$addToSet': {'$cond': ['$correct', '$item_id', None]}}}},
    ])).to_list(length=len(kinds) + 1)
    totals = {kind: sum(item['kind'] == kind for item in TAMIL_CATALOG) for kind in kinds}
    by_kind = {kind: {'attempts': 0, 'average_score': None, 'completed': 0, 'total': totals[kind]}
               for kind in kinds}
    total = scored = score_sum = recognition_attempts = recognition_correct = 0
    completed = set()
    for group in groups:
        if group['_id'] not in totals:
            continue
        total += group['attempts']; scored += group['scored_attempts']; score_sum += group['score_sum']
        recognition_attempts += group.get('recognition_attempts', 0)
        recognition_correct += group.get('recognition_correct', 0)
        completed_for_kind = {item for item in group.get('completed_items', []) if item}
        completed.update(completed_for_kind)
        by_kind[group['_id']] = {'attempts': group['attempts'],
                                  'average_score': round(group['average_score'], 2) if group['average_score'] is not None else None,
                                  'completed': len(completed_for_kind), 'total': totals[group['_id']]}
    item_groups = await (await db.tamil_attempts.aggregate([
        {'$match': {'user_id': user_id, 'mode': 'recognition', 'item_id': {'$in': list(BY_ID)}}},
        {'$group': {'_id': '$item_id', 'attempts': {'$sum': 1},
                    'correct_attempts': {'$sum': {'$cond': ['$correct', 1, 0]}},
                    'last_at': {'$max': '$created_at'},
                    'last_wrong_at': {'$max': {'$cond': ['$correct', None, '$created_at']}}}},
    ])).to_list(length=len(TAMIL_CATALOG))
    recognition_by_item = {
        group['_id']: {'attempts': group['attempts'], 'correct_attempts': group['correct_attempts'],
                       'accuracy': round(100 * group['correct_attempts'] / group['attempts'], 2),
                       'mastered': group['correct_attempts'] >= RECOGNITION_MASTERY_THRESHOLD}
        for group in item_groups if group['_id'] in BY_ID and group['attempts'] > 0
    }
    game_item_groups = await (await db.tamil_game_attempts.aggregate([
        {'$match': {'user_id': user_id, 'item_id': {'$in': list(BY_ID)}}},
        {'$group': {'_id': '$item_id', 'attempts': {'$sum': 1},
                    'correct_attempts': {'$sum': {'$cond': ['$correct', 1, 0]}},
                    'last_at': {'$max': '$created_at'},
                    'last_wrong_at': {'$max': {'$cond': ['$correct', None, '$created_at']}}}},
    ])).to_list(length=len(TAMIL_CATALOG))
    merged = {group['_id']: dict(group) for group in item_groups}
    for group in game_item_groups:
        current = merged.setdefault(group['_id'], {'_id': group['_id'], 'attempts': 0,
                                                      'correct_attempts': 0, 'last_at': None,
                                                      'last_wrong_at': None})
        current['attempts'] += group['attempts']
        current['correct_attempts'] += group['correct_attempts']
        current['last_at'] = max(filter(None, (current['last_at'], group['last_at'])), default=None)
        current['last_wrong_at'] = max(filter(None, (current['last_wrong_at'], group.get('last_wrong_at'))), default=None)
    mastery_by_item = {item_id: {'attempts': row['attempts'], 'correct_attempts': row['correct_attempts'],
                                 'mastered': row['correct_attempts'] >= RECOGNITION_MASTERY_THRESHOLD}
                       for item_id, row in merged.items() if item_id in BY_ID}
    mastered_items = [item['id'] for item in TAMIL_CATALOG
                      if mastery_by_item.get(item['id'], {}).get('mastered')]
    now = datetime.now(timezone.utc)
    review_by_item = {group['_id']: schedule for group in merged.values()
                      if group['_id'] in BY_ID and (schedule := review_schedule(group, now))}
    review_due_items = sorted((item_id for item_id, schedule in review_by_item.items() if schedule['due']),
                              key=lambda item_id: (review_by_item[item_id]['due_at'], item_id))
    recent = await db.tamil_attempts.find({'user_id': user_id}).sort('created_at', -1).limit(20).to_list(length=20)
    ordered_completed = [item['id'] for item in TAMIL_CATALOG if item['id'] in completed]
    game_rows = await (await db.tamil_game_attempts.aggregate([
        {'$match': {'user_id': user_id}},
        {'$group': {'_id': '$game_slug', 'attempts': {'$sum': 1},
                    'correct': {'$sum': {'$cond': ['$correct', 1, 0]}},
                    'last_at': {'$max': '$created_at'},
                    'items': {'$addToSet': {'$cond': ['$correct', '$item_id', None]}}}},
    ])).to_list(length=6)
    by_game = {row['_id']: {'attempts': row['attempts'], 'correct': row['correct'],
                            'accuracy': round(100 * row['correct'] / row['attempts'], 1),
                            'last_at': row['last_at']}
               for row in game_rows if row['attempts']}
    game_practiced = {item_id for row in game_rows for item_id in row['items'] if item_id}
    return {'total_attempts': total, 'scored_attempts': scored,
            'recognition_attempts': recognition_attempts, 'recognition_correct': recognition_correct,
            'recognition_mastery_threshold': RECOGNITION_MASTERY_THRESHOLD,
             'recognition_by_item': recognition_by_item, 'mastery_by_item': mastery_by_item,
             'mastered_items': mastered_items,
             'review_by_item': review_by_item, 'review_due_items': review_due_items,
            'completed_total': len(ordered_completed),
            'lesson_total': len(TAMIL_CATALOG), 'completed_items': ordered_completed,
            'average_score': round(score_sum / scored, 2) if scored else None,
            'by_kind': by_kind, 'recent_attempts': [public_attempt(row) for row in recent],
            'by_game': by_game, 'game_total_attempts': sum(row['attempts'] for row in game_rows),
            'game_practiced_items': [item['id'] for item in TAMIL_CATALOG if item['id'] in game_practiced]}


GAME_SLUGS = {'letter-match', 'find-letter', 'picture-word-match', 'listen-choose', 'word-builder'}
PICTURE_WORD_IDS = {'word-amma', 'word-appa', 'word-maram', 'word-naai', 'word-yaanai'}


class TamilGameAnswer(BaseModel):
    game_slug: str = Field(min_length=1, max_length=40)
    item_id: str = Field(min_length=1, max_length=80)
    selected_id: str | None = Field(default=None, max_length=80)
    written_text: str | None = Field(default=None, max_length=100)
    request_id: UUID


@router.post('/game-answer', dependencies=[Depends(answer_rate_limit)])
async def game_answer(payload: TamilGameAnswer, user: dict = Depends(get_current_user)):
    """Grade a catalog-backed game round and save it once per request ID."""
    if payload.game_slug not in GAME_SLUGS:
        raise HTTPException(422, 'Unknown Tamil game.')
    item = BY_ID.get(payload.item_id)
    selected = BY_ID.get(payload.selected_id) if payload.selected_id else None
    if item is None:
        raise HTTPException(422, 'Unknown Tamil item.')
    if payload.game_slug == 'picture-word-match' and payload.item_id not in PICTURE_WORD_IDS:
        raise HTTPException(422, 'This word has no approved picture yet.')
    if payload.game_slug == 'listen-choose' and not item.get('audio_available_human'):
        raise HTTPException(422, 'A human Tamil recording is needed for this game.')
    if payload.game_slug == 'word-builder':
        if item['kind'] != 'word' or payload.selected_id is not None or not payload.written_text:
            raise HTTPException(422, 'Build a known Tamil word.')
        written = normalize_written_tamil(payload.written_text)
        correct = written == normalize_written_tamil(item['text'])
    else:
        if (item['kind'] not in ({'word'} if payload.game_slug == 'picture-word-match' else {'vowel', 'consonant', 'aytham', 'uyirmei'})
                or selected is None or selected['kind'] != item['kind'] or payload.written_text is not None):
            raise HTTPException(422, 'Select a Tamil item of the same kind.')
        written = None
        correct = payload.selected_id == payload.item_id
    db = get_database()
    user_id = str(user['_id'])
    key = str(uuid5(NAMESPACE_URL, f'tamil-game:{user_id}:{payload.request_id}'))
    owned = {'_id': key, 'user_id': user_id}
    previous = await db.tamil_game_attempts.find_one(owned)
    if previous:
        if any(previous.get(field) != value for field, value in {
            'game_slug': payload.game_slug, 'item_id': payload.item_id,
            'selected_id': payload.selected_id, 'written_text': written}.items()):
            raise HTTPException(409, 'This request ID belongs to another game answer.')
        return {'attempt': public_attempt(previous), 'already_saved': True,
                'progress': await load_progress(db, user_id)}
    row = {'_id': key, 'id': key, 'user_id': user_id,
           'request_id': str(payload.request_id), 'game_slug': payload.game_slug,
           'item_id': payload.item_id, 'selected_id': payload.selected_id,
           'written_text': written, 'kind': item['kind'], 'text': item['text'],
           'correct': correct, 'score': 10 if correct else 0,
           'created_at': datetime.now(timezone.utc).isoformat()}
    try:
        await db.tamil_game_attempts.insert_one(row)
    except DuplicateKeyError:
        return await game_answer(payload, user)
    return {'attempt': public_attempt(row), 'already_saved': False,
            'progress': await load_progress(db, user_id)}


async def envelope(db, row, already_saved):
    return {'result': public_attempt(row), 'progress': await load_progress(db, row['user_id']),
            'already_saved': already_saved}


def check_replay(row, item_id, *, mode='audio', selected_id=None, selected_ids=None,
                 written_text=None, prompt_type=None):
    if (row['item_id'] != item_id or row.get('mode', 'audio') != mode or
            (mode == 'recognition' and (row.get('selected_id') != selected_id or
                                        row.get('selected_ids') != selected_ids or
                                        row.get('written_text') != written_text or
                                        row.get('prompt_type') != prompt_type))):
        raise HTTPException(409, 'This request ID already belongs to a different practice attempt.')


class RecognitionAnswer(BaseModel):
    item_id: str = Field(min_length=1, max_length=80)
    selected_id: str | None = Field(default=None, min_length=1, max_length=80)
    selected_ids: list[Annotated[str, Field(min_length=1, max_length=80)]] | None = Field(default=None, max_length=30)
    written_text: str | None = Field(default=None, min_length=1, max_length=200)
    prompt_type: str = Field(min_length=1, max_length=40)
    request_id: UUID


@router.post('/answer', dependencies=[Depends(answer_rate_limit)])
async def answer(payload: RecognitionAnswer, user: dict = Depends(get_current_user)):
    item = BY_ID.get(payload.item_id)
    if item is None:
        raise HTTPException(422, 'Select a known Tamil item.')
    selected = BY_ID.get(payload.selected_id) if payload.selected_id else None
    written_text = normalize_written_tamil(payload.written_text) if payload.written_text is not None else None
    expected_type = 'text_recognition' if item['kind'] in {'word', 'sentence'} else 'character_recognition'
    exercise = payload.prompt_type in {'meaning_matching', 'uyirmei_composition', 'sentence_ordering', 'text_writing'}
    if payload.prompt_type != 'text_writing' and payload.written_text is not None:
        raise HTTPException(422, 'Written text is only accepted for a writing exercise.')
    if payload.prompt_type in {expected_type, 'audio_recognition', 'meaning_matching'}:
        if payload.selected_ids is not None or selected is None or item['kind'] != selected['kind']:
            raise HTTPException(422, 'Select a known Tamil item of the same kind.')
        if payload.prompt_type == 'audio_recognition' and not item.get('audio_url'):
            raise HTTPException(422, 'This item does not have a validated listening example.')
        if payload.prompt_type == 'meaning_matching' and item['kind'] not in {'word', 'sentence'}:
            raise HTTPException(422, 'Meaning matching requires a word or sentence.')
        correct = payload.selected_id == payload.item_id
    elif payload.prompt_type == 'uyirmei_composition':
        parts = payload.selected_ids
        if (item['kind'] != 'uyirmei' or payload.selected_id is not None or not parts or len(parts) != 2 or
                BY_ID.get(parts[0], {}).get('kind') != 'consonant' or BY_ID.get(parts[1], {}).get('kind') != 'vowel'):
            raise HTTPException(422, 'Select one known consonant and one known vowel.')
        correct = parts == [item['consonant_id'], item['vowel_id']]
    elif payload.prompt_type == 'sentence_ordering':
        parts = payload.selected_ids
        tokens = item['text'].split()
        if (item['kind'] != 'sentence' or payload.selected_id is not None or parts is None or
                len(tokens) < 2 or len(tokens) > 30 or sorted(parts) != sorted(str(i) for i in range(len(tokens)))):
            raise HTTPException(422, 'Arrange every sentence word exactly once.')
        correct = parts == [str(i) for i in range(len(tokens))]
    elif payload.prompt_type == 'text_writing':
        if payload.selected_id is not None or payload.selected_ids is not None or not written_text:
            raise HTTPException(422, 'Enter a Tamil answer for the writing exercise.')
        correct = written_text == normalize_written_tamil(item['text'])
    else:
        raise HTTPException(422, f'This item requires prompt_type {expected_type}.')

    db = get_database()
    user_id, request_key = str(user['_id']), str(payload.request_id)
    attempt_id = str(uuid5(NAMESPACE_URL, f'tamil-attempt:{user_id}:{request_key}'))
    owned_key = {'_id': attempt_id, 'user_id': user_id}
    previous = await db.tamil_attempts.find_one(owned_key)
    if previous:
        check_replay(previous, payload.item_id, mode='recognition',
                     selected_id=payload.selected_id, selected_ids=payload.selected_ids,
                     written_text=written_text, prompt_type=payload.prompt_type)
        return await envelope(db, previous, True)

    row = {'_id': attempt_id, 'id': attempt_id, 'user_id': user_id,
            'request_id': request_key, 'item_id': payload.item_id, 'selected_id': payload.selected_id,
            'selected_ids': payload.selected_ids,
            'written_text': written_text,
           'prompt_type': payload.prompt_type, 'mode': 'recognition',
           'text': item['text'], 'kind': item['kind'], 'phoneme_target': item['phoneme_target'],
           'correct': correct, 'scorable': False, 'accuracy': None, 'confidence': None,
            'score_method': 'catalog_exercise_v1' if exercise else 'catalog_recognition_v1',
           'validation_status': 'answer_correct' if correct else 'answer_incorrect',
           'feedback': 'Correct answer.' if correct else 'Try this item again.',
           'created_at': datetime.now(timezone.utc).isoformat()}
    try:
        await db.tamil_attempts.insert_one(row)
    except DuplicateKeyError:
        previous = await db.tamil_attempts.find_one(owned_key)
        if previous is None:
            raise HTTPException(409, 'Another request updated this attempt. Retry with the same request ID.')
        check_replay(previous, payload.item_id, mode='recognition',
                     selected_id=payload.selected_id, selected_ids=payload.selected_ids,
                     written_text=written_text, prompt_type=payload.prompt_type)
        return await envelope(db, previous, True)
    return await envelope(db, row, False)


@router.get('/catalog')
async def catalog(_user: dict = Depends(get_current_user)):
    return {'items': TAMIL_CATALOG}


@router.get('/progress')
async def progress(user: dict = Depends(get_current_user)):
    return await load_progress(get_database(), str(user['_id']))


@router.get('/insights')
async def insights(user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = str(user['_id'])
    saved = await load_progress(db, user_id)
    config = await db.tamil_report_configs.find_one({'user_id': user_id})
    from .tamil_reports import provider_ready
    return run_learning_pipeline(saved, report_config=config,
                                 delivery_provider_ready=provider_ready(config.get('channel', '')) if config else False)


@router.post('/evaluate', dependencies=[Depends(audio_rate_limit)])
async def evaluate(audio: UploadFile = File(...), item_id: str = Form(..., max_length=80),
                   request_id: UUID = Form(...), browser_transcript: str = Form('', max_length=500),
                   user: dict = Depends(get_current_user)):
    item = BY_ID.get(item_id)
    if item is None:
        raise HTTPException(422, 'Unknown Tamil practice item.')
    db = get_database()
    user_id, request_key = str(user['_id']), str(request_id)
    # Mongo's unique _id protects parallel inserts even during index migration.
    attempt_id = str(uuid5(NAMESPACE_URL, f'tamil-attempt:{user_id}:{request_key}'))
    owned_key = {'_id': attempt_id, 'user_id': user_id}
    previous = await db.tamil_attempts.find_one(owned_key)
    if previous:
        check_replay(previous, item_id)
        return await envelope(db, previous, True)
    if audio.content_type and audio.content_type.split(';')[0].strip().lower() not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(415, 'Unsupported audio type.')
    max_bytes = min(settings.MAX_UPLOAD_BYTES, 5 * 1024 * 1024)
    payload = await audio.read(max_bytes + 1)
    if not payload:
        raise HTTPException(400, 'Empty audio file.')
    if len(payload) > max_bytes:
        raise HTTPException(413, 'Audio file too large. Maximum size is 5 MB.')
    # The existing decoder rejects recordings over 20 seconds before inference.
    try:
        measured = await run_in_threadpool(evaluate_item_audio, payload, item, browser_transcript)
    except (ImportError, FileNotFoundError):
        measured = {'scorable': False, 'accuracy': None, 'validation_status': 'recognizer_unavailable',
                    'feedback': 'The speech model is unavailable. Please try again later.'}
    except Exception:
        measured = {'scorable': False, 'accuracy': None, 'validation_status': 'processing_error',
                    'feedback': 'We could not process this recording. Please record again.'}
    measured['correct'] = bool(measured.get('scorable') and measured.get('phoneme_match') is True)
    row = {**safe_result(measured), '_id': attempt_id, 'id': attempt_id, 'user_id': user_id,
           'request_id': request_key, 'item_id': item_id, 'text': item['text'], 'kind': item['kind'],
           'phoneme_target': item['phoneme_target'], 'mode': 'audio',
           'created_at': datetime.now(timezone.utc).isoformat()}
    try:
        await db.tamil_attempts.insert_one(row)
    except DuplicateKeyError:
        previous = await db.tamil_attempts.find_one(owned_key)
        if previous is None:
            raise HTTPException(409, 'Another request updated this attempt. Retry with the same request ID.')
        check_replay(previous, item_id)
        return await envelope(db, previous, True)
    return await envelope(db, row, False)
