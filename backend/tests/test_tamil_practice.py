"""Tamil practice preserves acoustic evidence, ownership and bounded requests."""
from copy import deepcopy
import io
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4
import wave

from bson import ObjectId
import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from app.routers import tamil
from app.tamil_curriculum import TAMIL_CATALOG
from app.services.phoneme_pipeline import PhonemeEvaluator, TARGET_PHONES
from app.utils.jwt_handler import get_current_user


class Cursor:
    def __init__(self, rows): self.rows = deepcopy(rows)
    def sort(self, key, direction):
        self.rows.sort(key=lambda row: row[key], reverse=direction < 0)
        return self
    def limit(self, count): self.rows = self.rows[:count]; return self
    async def to_list(self, length): return self.rows[:length]


class Collection:
    def __init__(self): self.rows = []; self.collision = False
    def matches(self, row, query):
        return all(row.get(k) in v['$in'] if isinstance(v, dict) and '$in' in v else row.get(k) == v
                   for k, v in query.items())
    async def find_one(self, query): return next((deepcopy(r) for r in self.rows if self.matches(r, query)), None)
    def find(self, query): return Cursor([r for r in self.rows if self.matches(r, query)])
    async def insert_one(self, row):
        if any(r['_id'] == row['_id'] for r in self.rows): raise DuplicateKeyError('duplicate')
        self.rows.append(deepcopy(row))
        if self.collision: raise DuplicateKeyError('concurrent insertion won')
    async def aggregate(self, pipeline):
        selected = [r for r in self.rows if self.matches(r, pipeline[0]['$match'])]
        if pipeline[1]['$group']['_id'] == '$game_slug':
            return Cursor([{'_id': slug, 'attempts': len(rows),
                            'correct': sum(row['correct'] is True for row in rows),
                            'last_at': max(row['created_at'] for row in rows),
                            'items': [row['item_id'] for row in rows if row['correct']]}
                           for slug in sorted({row['game_slug'] for row in selected})
                           if (rows := [row for row in selected if row['game_slug'] == slug])])
        if pipeline[1]['$group']['_id'] == '$item_id':
            return Cursor([{'_id': item_id, 'attempts': len(rows),
                             'correct_attempts': sum(row['correct'] for row in rows),
                             'last_at': max(row['created_at'] for row in rows),
                             'last_wrong_at': max((row['created_at'] for row in rows if not row['correct']), default=None)}
                           for item_id in sorted({row['item_id'] for row in selected})
                           if (rows := [row for row in selected if row['item_id'] == item_id])])
        groups = []
        for kind in ('word', 'sentence', 'vowel', 'consonant', 'aytham', 'uyirmei'):
            rows = [r for r in selected if r['kind'] == kind]
            scores = [r['accuracy'] for r in rows if r['scorable']]
            if rows: groups.append({'_id': kind, 'attempts': len(rows),
                                    'recognition_attempts': sum(r.get('mode') == 'recognition' for r in rows),
                                    'recognition_correct': sum(r.get('mode') == 'recognition' and r.get('correct') is True for r in rows),
                                    'scored_attempts': len(scores),
                                    'score_sum': sum(scores), 'average_score': sum(scores) / len(scores) if scores else None,
                                    'completed_items': sorted({r['item_id'] for r in rows if r.get('correct') is True})})
        return Cursor(groups)


@pytest.fixture
def setup(monkeypatch):
    tamil.audio_rate_limit._hits.clear()
    db = SimpleNamespace(tamil_attempts=Collection(), tamil_game_attempts=Collection())
    monkeypatch.setattr(tamil, 'get_database', lambda: db)
    calls = []
    def evaluate(data, target):
        calls.append((data, target))
        return {'accuracy': 75.0, 'confidence': .7312, 'scorable': True, 'phoneme_match': False,
                'validation_status': 'not_matched',
                'feedback': 'Try again', 'expected_phonemes': TARGET_PHONES[target], 'actual_phonemes': ['a'],
                'validation_source': 'acoustic_phoneme_model', 'debug_features': {'secret': True},
                'audio': data, 'audio_quality': {'duration_seconds': 1, 'has_speech': True,
                                                 'raw_audio': 'private'}}
    monkeypatch.setattr(tamil, 'evaluate_audio', evaluate)
    app = FastAPI(); app.include_router(tamil.router)
    app.dependency_overrides[get_current_user] = lambda: {'_id': 'child-1'}
    with TestClient(app) as client: yield client, db, app, calls


def record(client, item='word-amma', request_id=None, data=b'wave', **extra):
    return client.post('/api/tamil/evaluate', data={'item_id': item, 'request_id': request_id or str(uuid4()), **extra},
                       files={'audio': ('take.wav', data, 'audio/wav')})


def wav(duration=1, amplitude=.2):
    pcm = (amplitude * np.sin(np.arange(int(duration * 16000)) * 2 * np.pi * 220 / 16000) * 32767).astype('<i2')
    out = io.BytesIO()
    with wave.open(out, 'wb') as handle:
        handle.setnchannels(1); handle.setsampwidth(2); handle.setframerate(16000); handle.writeframes(pcm.tobytes())
    return out.getvalue()


def test_authentication_required():
    app = FastAPI(); app.include_router(tamil.router)
    with TestClient(app) as client:
        assert client.get('/api/tamil/catalog').status_code == 401
        assert client.get('/api/tamil/progress').status_code == 401
        assert record(client).status_code == 401
        assert client.post('/api/tamil/answer', json={
            'item_id': 'letter-a', 'selected_id': 'letter-a',
            'prompt_type': 'character_recognition', 'request_id': str(uuid4()),
        }).status_code == 401


def test_catalog_canonical_order_grammar_and_explicit_supported_ipa(setup):
    client, _, _, _ = setup
    items = client.get('/api/tamil/catalog').json()['items']
    assert len(items) == 265
    vowels = [r for r in items if r['kind'] == 'vowel']
    assert [r['text'] for r in vowels] == list('அஆஇஈஉஊஎஏஐஒஓஔ')
    assert sum(r['length_label'] == 'kuril' for r in vowels) == 5
    assert sum(r['length_label'] == 'nedil' for r in vowels) == 7
    assert [r['transliteration'] for r in vowels] == ['a', 'aa', 'i', 'ee', 'u', 'oo', 'e', 'ē', 'ai', 'o', 'ō', 'au']
    assert all(r.get('audio_url') and r['audio_kind'] == 'human_tamil' for r in vowels)
    vocab = json.loads((Path(__file__).parents[1] / 'models/phoneme-onnx/vocab.json').read_text(encoding='utf8'))
    assert len({r['id'] for r in items}) == len(items)
    for row in items:
        assert row['tip_ta'] and row['tip'] and row['text']
        if row['can_evaluate']:
            assert TARGET_PHONES[row['phoneme_target']]
            assert set(TARGET_PHONES[row['phoneme_target']]) <= vocab.keys()
            assert row.get('audio_url'), f"Missing listening example for {row['id']}"
        else:
            assert row['kind'] in {'consonant', 'uyirmei', 'aytham'}
            assert not row.get('audio_url')
    consonants = [r for r in items if r['kind'] == 'consonant']
    aytham = [r for r in items if r['kind'] == 'aytham']
    assert len(aytham) == 1 and aytham[0]['text'] == 'ஃ'
    assert aytham[0]['can_evaluate'] is False
    combinations = [r for r in items if r['kind'] == 'uyirmei']
    assert [r['text'] for r in consonants] == list('க் ங் ச் ஞ் ட் ண் த் ந் ப் ம் ய் ர் ல் வ் ழ் ள் ற் ன்'.split())
    assert len(combinations) == 216
    assert len({r['text'] for r in combinations}) == 216
    assert [r['text'] for r in combinations if r['consonant_id'] == 'consonant-ka'] == list('க கா கி கீ கு கூ கெ கே கை கொ கோ கௌ'.split())
    assert all(r['vowel_id'] == f"letter-{r['vowel_target']}" for r in combinations)
    assert [r['text'] for r in items if r['kind'] == 'word'] == [
        'அம்மா', 'அப்பா', 'மரம்', 'நாய்', 'யானை', 'பழம்', 'ஆடு', 'இலை', 'உப்பு', 'எலி']
    assert [r['meaning'] for r in items if r['kind'] == 'word'] == [
        'Mother', 'Father', 'Tree', 'Dog', 'Elephant', 'Fruit', 'Goat', 'Leaf', 'Salt', 'Mouse']
    assert [r['text'] for r in items if r['kind'] == 'sentence'] == [
        'அம்மா வீட்டில் இருக்கிறார்.', 'நாய் ஓடுகிறது.',
        'அம்மா, வா.', 'அப்பா, வா.', 'கவி, வா.', 'இது மரம்.', 'இது பழம்.', 'அப்பா, மரத்தைப் பார்.']
    assert [r['meaning'] for r in items if r['kind'] == 'sentence'] == [
        'Mother is at home.', 'The dog is running.', 'Mother, come.', 'Father, come.',
        'Kavi, come.', 'This is a tree.', 'This is a fruit.', 'Father, look at the tree.']
    reference_ids = {r['id'] for r in items if r.get('audio_url')}
    manifest = json.loads((Path(__file__).parents[2] / 'frontend/public/assets/tamil-reference/manifest.json').read_text(encoding='utf8'))
    assert reference_ids == {r['id'] for r in manifest['items']}
    assert len(reference_ids) == 30


def test_every_word_listening_example_uses_the_vetted_tamil_neural_voice():
    """Prevent older MMS word clips from returning to the learner-facing catalog."""
    manifest_path = Path(__file__).parents[2] / 'frontend/public/assets/tamil-reference/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    words = [row for row in manifest['items'] if row['kind'] == 'word']

    assert len(words) == 10
    assert all(row.get('synthesis_provider') == 'Microsoft Edge online speech service'
               for row in words)
    assert all(row.get('synthesis_voice') == 'ta-IN-ValluvarNeural' for row in words)
    assert all(row.get('synthesis_text') == row['text'] for row in words)
    assert all(row['filename'] == f"{row['id']}-valluvar.wav" for row in words)
    assert all(row['audio_url'] == f"/assets/tamil-reference/{row['id']}-valluvar.wav"
               for row in words)


def test_forged_target_cannot_control_recognition_and_all_vowels_use_catalog_target(setup, monkeypatch):
    client, db, _, calls = setup
    monkeypatch.setattr(tamil, 'transcribe_tamil', lambda _audio: '')
    assert record(client, item='forged').status_code == 422
    assert record(client, request_id='not-a-uuid').status_code == 422
    assert not calls and not db.tamil_attempts.rows
    assert record(client, item='letter-a').status_code == 200
    assert calls[-1][1] == 'a'
    response = record(client, target_phoneme='pazham', user_id='another-child')
    assert response.status_code == 200
    assert calls[-1][1] == 'amma'  # Only the catalog-authored target reaches acoustic scoring.
    assert db.tamil_attempts.rows[0]['user_id'] == 'child-1'


def test_browser_tamil_transcript_grades_audible_word_without_openai(setup, monkeypatch):
    client, _, _, calls = setup
    monkeypatch.setattr(tamil, 'transcribe_tamil', Mock(side_effect=AssertionError('server ASR should not run')))

    response = record(client, item='word-amma', browser_transcript='அம்மா')

    assert response.status_code == 200, response.text
    result = response.json()['result']
    assert result['scorable'] is True
    assert result['accuracy'] == 100
    assert result['correct'] is True
    assert result['recognized_text'] == 'அம்மா'
    assert result['validation_source'] == 'browser_tamil_speech_recognition'
    assert result['audio_quality']['has_speech'] is True
    assert calls == [(b'wave', 'amma')]


def test_browser_transcript_cannot_score_silent_audio(setup, monkeypatch):
    client, _, _, calls = setup

    def no_speech(data, target):
        calls.append((data, target))
        return {'accuracy': None, 'scorable': False, 'phoneme_match': False,
                'validation_status': 'no_speech', 'validation_source': 'none',
                'feedback': 'No speech', 'audio_quality': {'has_speech': False}}

    monkeypatch.setattr(tamil, 'evaluate_audio', no_speech)
    response = record(client, item='word-amma', browser_transcript='அம்மா')

    assert response.status_code == 200, response.text
    assert response.json()['result']['scorable'] is False
    assert response.json()['result']['validation_status'] == 'no_speech'
    assert calls == [(b'wave', 'amma')]


def test_raw_acoustic_score_persistence_and_idempotent_retry(setup):
    client, db, _, calls = setup
    request_id = str(uuid4())
    first = record(client, item='letter-a', request_id=request_id).json()
    repeated = record(client, item='letter-a', request_id=request_id).json()
    assert repeated['already_saved'] is True and first['already_saved'] is False
    assert repeated['result'] == first['result']
    assert len(calls) == len(db.tamil_attempts.rows) == 1
    assert first['result']['accuracy'] == 75 and first['result']['confidence'] == .7312
    stored = db.tamil_attempts.rows[0]
    assert 'debug_features' not in stored and 'audio' not in stored
    assert 'raw_audio' not in stored['audio_quality']
    assert record(client, item='word-appa', request_id=request_id).status_code == 409


def test_concurrent_duplicate_returns_winner(setup):
    client, db, _, _ = setup
    db.tamil_attempts.collision = True
    response = record(client)
    assert response.status_code == 200, response.text
    assert response.json()['already_saved'] is True
    assert len(db.tamil_attempts.rows) == 1


@pytest.mark.parametrize('item', [
    'letter-a', 'letter-aa', 'letter-i', 'letter-ii', 'letter-u', 'letter-uu',
    'letter-e', 'letter-ee', 'letter-ai', 'letter-o', 'letter-oo', 'letter-au',
    'word-amma', 'word-appa', 'word-maram', 'word-naai', 'word-yaanai', 'word-pazham',
    'word-aadu', 'word-ilai', 'word-uppu', 'word-eli',
    'sentence-amma-veettil', 'sentence-naai-odugiradhu',
    'sentence-amma-vaa', 'sentence-appa-vaa', 'sentence-kavi-vaa',
    'sentence-idhu-maram', 'sentence-idhu-pazham', 'sentence-appa-maram',
])
def test_all_voice_targets_use_server_authored_phonemes_when_transcription_is_empty(setup, item, monkeypatch):
    client, _, _, calls = setup
    monkeypatch.setattr(tamil, 'transcribe_tamil', lambda _audio: '')
    response = record(client, item=item)
    assert response.status_code == 200, response.text
    expected = next(row['phoneme_target'] for row in TAMIL_CATALOG if row['id'] == item)
    assert response.json()['result']['scorable'] is True
    assert calls == [(b'wave', expected)]


@pytest.mark.parametrize('item_id,target,text,kind', [
    ('word-amma', 'amma', 'அம்மா', 'word'),
    ('sentence-kavi-vaa', 'kavi_vaa', 'கவி, வா.', 'sentence'),
])
def test_words_and_sentences_fall_back_to_acoustic_scoring_when_tamil_asr_is_unavailable(
        setup, monkeypatch, item_id, target, text, kind):
    client, _, _, calls = setup

    def unavailable(_audio):
        raise tamil.IndicConformerUnavailable('optional transcription runtime is offline')

    monkeypatch.setattr(tamil, 'transcribe_tamil', unavailable)

    response = record(client, item=item_id)

    assert response.status_code == 200, response.text
    result = response.json()['result']
    assert result == {
        'accuracy': 75.0,
        'scorable': True,
        'phoneme_match': False,
        'confidence': .7312,
        'feedback': 'Try again',
        'validation_status': 'not_matched',
        'validation_source': 'acoustic_phoneme_model',
        'expected_phonemes': TARGET_PHONES[target],
        'actual_phonemes': ['a'],
        'correct': False,
        'audio_quality': {'duration_seconds': 1, 'has_speech': True},
        'item_id': item_id,
        'text': text,
        'kind': kind,
        'phoneme_target': target,
        'mode': 'audio',
        'created_at': result['created_at'],
        'request_id': result['request_id'],
        'id': result['id'],
    }
    assert calls == [(b'wave', target)]


@pytest.mark.parametrize('duration,amplitude,status', [(1, 0, 'no_speech'), (21, .2, 'invalid_audio')])
def test_bad_acoustic_input_never_reaches_model_or_becomes_score(setup, monkeypatch, duration, amplitude, status):
    client, _, _, _ = setup
    def unexpected(_): pytest.fail('Invalid audio must not invoke recognizer')
    monkeypatch.setattr(tamil, 'evaluate_audio', PhonemeEvaluator(recognizer=unexpected).evaluate_pronunciation)
    response = record(client, item='letter-a', data=wav(duration, amplitude)).json()
    assert response['result']['validation_status'] == status
    assert response['result']['accuracy'] is None
    assert response['progress']['scored_attempts'] == 0
    assert response['progress']['average_score'] is None


def test_model_unavailable_and_scores_invalid_are_unscorable(setup, monkeypatch):
    client, _, _, _ = setup
    def unavailable(_): raise RuntimeError('No model')
    monkeypatch.setattr(tamil, 'evaluate_audio', PhonemeEvaluator(recognizer=unavailable).evaluate_pronunciation)
    response = record(client, data=wav()).json()
    assert response['result']['validation_status'] == 'recognizer_unavailable'
    assert response['result']['accuracy'] is None
    for score in (float('nan'), float('inf'), -1, 101, True):
        monkeypatch.setattr(tamil, 'evaluate_audio', lambda *_: {'scorable': True, 'accuracy': score})
        result = record(client).json()['result']
        assert result['accuracy'] is None and result['scorable'] is False
        assert result['correct'] is False


def test_upload_limits_and_empty_audio(setup, monkeypatch):
    client, _, _, calls = setup
    assert record(client, data=b'').status_code == 400
    monkeypatch.setattr(tamil.settings, 'MAX_UPLOAD_BYTES', 3)
    assert record(client).status_code == 413
    response = client.post('/api/tamil/evaluate', data={'item_id': 'word-amma', 'request_id': str(uuid4())},
                           files={'audio': ('file.txt', b'x', 'text/plain')})
    assert response.status_code == 415
    assert not calls


def test_progress_is_owner_scoped_kind_aware_and_recent_bounded(setup, monkeypatch):
    client, db, app, _ = setup
    monkeypatch.setattr(tamil, 'transcribe_tamil', lambda _audio: '')
    for index in range(22):
        assert record(client, item='word-amma' if index % 2 else 'sentence-amma-veettil').status_code == 200
    progress = client.get('/api/tamil/progress').json()
    assert progress['total_attempts'] == 22
    assert progress['scored_attempts'] == 22
    assert progress['average_score'] == 75
    assert progress['by_kind']['word']['attempts'] == progress['by_kind']['sentence']['attempts'] == 11
    assert progress['by_kind']['word']['average_score'] == 75
    assert progress['by_kind']['sentence']['average_score'] == 75
    assert progress['by_kind']['vowel']['average_score'] is None
    assert len(progress['recent_attempts']) == 20
    assert all('user_id' not in row and '_id' not in row for row in progress['recent_attempts'])
    app.dependency_overrides[get_current_user] = lambda: {'_id': 'other-child'}
    assert client.get('/api/tamil/progress').json()['total_attempts'] == 0


def test_progress_counts_each_correct_lesson_once_even_after_retries(setup, monkeypatch):
    client, _, _, _ = setup
    for item_id in ('word-amma', 'word-amma', 'word-appa'):
        assert client.post('/api/tamil/answer', json={
            'item_id': item_id, 'selected_id': item_id,
            'prompt_type': 'text_recognition', 'request_id': str(uuid4()),
        }).status_code == 200
    progress = client.get('/api/tamil/progress').json()
    assert progress['completed_items'] == ['word-amma', 'word-appa']
    assert progress['completed_total'] == 2
    assert progress['lesson_total'] == 265
    assert progress['by_kind']['word']['completed'] == 2
    assert progress['by_kind']['word']['total'] == 10
    assert progress['by_kind']['vowel']['total'] == 12
    assert progress['by_kind']['sentence']['total'] == 8
    assert progress['by_kind']['consonant']['total'] == 18
    assert progress['by_kind']['aytham']['total'] == 1
    assert progress['by_kind']['uyirmei']['total'] == 216


def test_character_catalog_items_do_not_claim_unsupported_acoustic_scores(setup):
    client, _, _, calls = setup
    result = record(client, item='uyirmei-ka-aa').json()['result']
    assert result['validation_status'] == 'unsupported_target'
    assert result['scorable'] is False and result['accuracy'] is None
    assert result['correct'] is False
    assert not calls


@pytest.mark.parametrize('item_id,selected_id,prompt_type,expected', [
    ('letter-a', 'letter-a', 'character_recognition', True),
    ('consonant-ka', 'consonant-nga', 'character_recognition', False),
    ('uyirmei-ka-aa', 'uyirmei-ka-aa', 'character_recognition', True),
    ('word-amma', 'word-amma', 'text_recognition', True),
    ('sentence-amma-veettil', 'sentence-naai-odugiradhu', 'text_recognition', False),
])
def test_recognition_answer_is_checked_and_saved_without_acoustic_score(setup, item_id, selected_id, prompt_type, expected):
    client, db, _, calls = setup
    response = client.post('/api/tamil/answer', json={
        'item_id': item_id, 'selected_id': selected_id, 'prompt_type': prompt_type,
        'request_id': str(uuid4()),
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['result']['correct'] is expected
    assert body['result']['scorable'] is False
    assert body['result']['accuracy'] is None
    assert body['result']['score_method'] == 'catalog_recognition_v1'
    assert body['progress']['scored_attempts'] == 0
    assert body['progress']['average_score'] is None
    assert body['progress']['recognition_attempts'] == 1
    assert body['progress']['recognition_correct'] == int(expected)
    assert (item_id in body['progress']['completed_items']) is expected
    assert not calls and len(db.tamil_attempts.rows) == 1


def test_recognition_answer_validation_idempotency_and_owner_scope(setup):
    client, db, app, calls = setup
    request_id = str(uuid4())
    answer = {'item_id': 'consonant-ka', 'selected_id': 'consonant-ka',
              'prompt_type': 'character_recognition', 'request_id': request_id}
    first = client.post('/api/tamil/answer', json=answer)
    second = client.post('/api/tamil/answer', json=answer)
    assert first.status_code == second.status_code == 200
    assert first.json()['already_saved'] is False
    assert second.json()['already_saved'] is True
    assert client.post('/api/tamil/answer', json={**answer, 'selected_id': 'consonant-nga'}).status_code == 409
    assert record(client, item='consonant-ka', request_id=request_id).status_code == 409
    assert client.post('/api/tamil/answer', json={**answer, 'selected_id': 'word-amma', 'request_id': str(uuid4())}).status_code == 422
    assert client.post('/api/tamil/answer', json={**answer, 'prompt_type': 'text_recognition', 'request_id': str(uuid4())}).status_code == 422
    assert client.post('/api/tamil/answer', json={**answer, 'item_id': 'unknown', 'request_id': str(uuid4())}).status_code == 422
    assert len(db.tamil_attempts.rows) == 1 and not calls
    app.dependency_overrides[get_current_user] = lambda: {'_id': 'other-child'}
    assert client.get('/api/tamil/progress').json()['total_attempts'] == 0
    assert client.post('/api/tamil/answer', json=answer).json()['already_saved'] is False
    assert len(db.tamil_attempts.rows) == 2


@pytest.mark.parametrize('item_id', ['letter-a', 'word-amma', 'sentence-amma-veettil'])
def test_listening_answer_requires_a_real_audio_example(setup, item_id):
    client, _, _, _ = setup
    response = client.post('/api/tamil/answer', json={
        'item_id': item_id, 'selected_id': item_id,
        'prompt_type': 'audio_recognition', 'request_id': str(uuid4()),
    })
    assert response.status_code == 200, response.text
    assert response.json()['result']['prompt_type'] == 'audio_recognition'
    assert response.json()['result']['correct'] is True
    assert client.post('/api/tamil/answer', json={
        'item_id': 'consonant-ka', 'selected_id': 'consonant-ka',
        'prompt_type': 'audio_recognition', 'request_id': str(uuid4()),
    }).status_code == 422


def test_recognition_progress_aggregates_per_item_accuracy_and_mastery(setup):
    client, _, _, calls = setup
    base = {'item_id': 'consonant-ka', 'prompt_type': 'character_recognition'}
    for selected_id in ('consonant-ka', 'consonant-ka', 'consonant-nga'):
        response = client.post('/api/tamil/answer', json={**base, 'selected_id': selected_id,
                                                          'request_id': str(uuid4())})
        assert response.status_code == 200
    before = client.get('/api/tamil/progress').json()
    assert before['recognition_by_item']['consonant-ka'] == {
        'attempts': 3, 'correct_attempts': 2, 'accuracy': 66.67, 'mastered': False}
    assert before['mastered_items'] == []
    assert before['recognition_mastery_threshold'] == 3
    response = client.post('/api/tamil/answer', json={**base, 'selected_id': 'consonant-ka',
                                                      'request_id': str(uuid4())})
    assert response.status_code == 200
    after = response.json()['progress']
    assert after['recognition_by_item']['consonant-ka'] == {
        'attempts': 4, 'correct_attempts': 3, 'accuracy': 75.0, 'mastered': True}
    assert after['mastered_items'] == ['consonant-ka']
    assert after['recognition_attempts'] == 4
    assert after['recognition_correct'] == 3
    assert after['scored_attempts'] == 0 and after['average_score'] is None
    assert not calls


def test_review_schedule_uses_persisted_attempts_and_prioritizes_misses(setup):
    client, db, _, _ = setup
    base = {'item_id': 'word-amma', 'selected_id': 'word-amma', 'prompt_type': 'text_recognition'}
    first = client.post('/api/tamil/answer', json={**base, 'request_id': str(uuid4())})
    assert first.status_code == 200
    schedule = first.json()['progress']['review_by_item']['word-amma']
    assert schedule['interval_days'] == 1 and schedule['due'] is False
    db.tamil_attempts.rows[0]['created_at'] = '2020-01-01T00:00:00+00:00'
    refreshed = client.get('/api/tamil/progress').json()
    assert refreshed['review_due_items'] == ['word-amma']
    wrong = client.post('/api/tamil/answer', json={**base, 'selected_id': 'word-appa',
                                                   'request_id': str(uuid4())}).json()['progress']
    assert wrong['review_by_item']['word-amma']['interval_days'] == 0
    assert wrong['review_due_items'] == ['word-amma']


@pytest.mark.parametrize('item_id,prompt_type,selected_id,selected_ids,correct', [
    ('word-amma', 'meaning_matching', 'word-amma', None, True),
    ('sentence-amma-veettil', 'meaning_matching', 'sentence-naai-odugiradhu', None, False),
    ('uyirmei-ka-aa', 'uyirmei_composition', None, ['consonant-ka', 'letter-aa'], True),
    ('uyirmei-ka-aa', 'uyirmei_composition', None, ['consonant-nga', 'letter-aa'], False),
    ('sentence-amma-veettil', 'sentence_ordering', None, ['0', '1', '2'], True),
    ('sentence-amma-veettil', 'sentence_ordering', None, ['1', '0', '2'], False),
])
def test_catalog_exercises_are_graded_and_saved(setup, item_id, prompt_type, selected_id, selected_ids, correct):
    client, db, _, _ = setup
    payload = {'item_id': item_id, 'prompt_type': prompt_type, 'request_id': str(uuid4())}
    if selected_id is not None: payload['selected_id'] = selected_id
    if selected_ids is not None: payload['selected_ids'] = selected_ids
    response = client.post('/api/tamil/answer', json=payload)
    assert response.status_code == 200, response.text
    result = response.json()['result']
    assert result['correct'] is correct
    assert result['score_method'] == 'catalog_exercise_v1'
    assert result['scorable'] is False and result['accuracy'] is None
    assert response.json()['progress']['recognition_attempts'] == 1
    assert len(db.tamil_attempts.rows) == 1


def test_catalog_exercises_reject_forgery_and_replay_changes(setup):
    client, db, _, _ = setup
    base = {'item_id': 'sentence-amma-veettil', 'prompt_type': 'sentence_ordering',
            'request_id': str(uuid4())}
    for order in (['0', '0', '2'], ['0', '1'], ['0', '1', '99'], ['0', '1', 'x']):
        assert client.post('/api/tamil/answer', json={**base, 'selected_ids': order}).status_code == 422
    assert client.post('/api/tamil/answer', json={**base, 'selected_ids': ['0', '1', '2']}).status_code == 200
    assert client.post('/api/tamil/answer', json={**base, 'selected_ids': ['0', '1', '2']}).json()['already_saved'] is True
    assert client.post('/api/tamil/answer', json={**base, 'selected_ids': ['1', '0', '2']}).status_code == 409
    assert client.post('/api/tamil/answer', json={**base, 'selected_ids': ['0', '1', '2'],
                                                  'item_id': 'sentence-naai-odugiradhu'}).status_code == 422
    assert client.post('/api/tamil/answer', json={**base, 'item_id': 'uyirmei-ka-aa',
                                                  'prompt_type': 'uyirmei_composition',
                                                  'selected_ids': ['word-amma', 'letter-aa'],
                                                  'request_id': str(uuid4())}).status_code == 422
    assert client.post('/api/tamil/answer', json={**base, 'item_id': 'consonant-ka',
                                                  'prompt_type': 'meaning_matching',
                                                  'selected_id': 'consonant-ka',
                                                  'request_id': str(uuid4())}).status_code == 422
    assert len(db.tamil_attempts.rows) == 1


def test_tamil_writing_is_normalized_graded_and_idempotent(setup):
    client, db, _, _ = setup
    base = {'item_id': 'sentence-amma-vaa', 'prompt_type': 'text_writing',
            'written_text': 'அம்மா  வா!', 'request_id': str(uuid4())}
    first = client.post('/api/tamil/answer', json=base)
    assert first.status_code == 200, first.text
    assert first.json()['result']['correct'] is True
    assert first.json()['result']['scorable'] is False
    assert first.json()['result']['score_method'] == 'catalog_exercise_v1'
    assert client.post('/api/tamil/answer', json=base).json()['already_saved'] is True
    assert client.post('/api/tamil/answer', json={**base, 'written_text': 'அப்பா வா!'}).status_code == 409
    wrong = client.post('/api/tamil/answer', json={**base, 'written_text': 'அம்மாவா',
                                                   'request_id': str(uuid4())})
    assert wrong.status_code == 200 and wrong.json()['result']['correct'] is False
    assert client.post('/api/tamil/answer', json={**base, 'selected_id': 'sentence-amma-vaa',
                                                  'request_id': str(uuid4())}).status_code == 422
    assert len(db.tamil_attempts.rows) == 2


def test_aytham_is_writable_without_an_invented_speech_score(setup):
    client, _, _, _ = setup
    answer = client.post('/api/tamil/answer', json={
        'item_id': 'aytham-symbol', 'prompt_type': 'text_writing',
        'written_text': 'ஃ', 'request_id': str(uuid4()),
    })
    assert answer.status_code == 200
    assert answer.json()['result']['correct'] is True
    assert answer.json()['result']['scorable'] is False
    assert answer.json()['progress']['by_kind']['aytham']['completed'] == 1


def test_words_and_sentences_prefer_normalized_tamil_asr_and_reject_different_content(setup, monkeypatch):
    client, _, _, model_calls = setup
    monkeypatch.setattr(tamil, 'transcribe_tamil', lambda _audio: '  அம்மா. ')
    matched = record(client, item='word-amma').json()['result']
    assert matched['correct'] is True
    assert matched['recognized_text'] == 'அம்மா.'
    assert matched['validation_source'] == 'server_indicconformer'
    assert matched['score_method'] == 'tamil_text_similarity_v2'
    assert not model_calls

    sentence = next(row for row in TAMIL_CATALOG if row['id'] == 'sentence-amma-veettil')['text']
    father = next(row for row in TAMIL_CATALOG if row['id'] == 'word-appa')['text']
    mother = next(row for row in TAMIL_CATALOG if row['id'] == 'word-amma')['text']
    monkeypatch.setattr(tamil, 'transcribe_tamil', lambda _audio: sentence.replace(mother, father))
    swapped = record(client, item='sentence-amma-veettil').json()['result']
    assert swapped['correct'] is False
    assert swapped['validation_status'] == 'not_matched'
    assert swapped['text_similarity'] > .9

    monkeypatch.setattr(tamil, 'transcribe_tamil', lambda _audio: 'அப்பா')
    different = record(client, item='word-amma').json()['result']
    assert different['correct'] is False
    assert different['validation_status'] == 'not_matched'
    assert not model_calls


def test_five_games_save_catalog_answers_once_and_feed_progress(setup):
    client, db, _, _ = setup
    examples = [
        ('letter-match', 'letter-a', 'letter-a', None),
        ('find-letter', 'consonant-zha', 'consonant-zha', None),
        ('picture-word-match', 'word-amma', 'word-amma', None),
        ('listen-choose', 'letter-ii', 'letter-ii', None),
        ('word-builder', 'word-appa', None, 'அப்பா'),
    ]
    for game, item, selected, written in examples:
        request_id = str(uuid4())
        payload = {'game_slug': game, 'item_id': item, 'selected_id': selected,
                   'written_text': written, 'request_id': request_id}
        first = client.post('/api/tamil/game-answer', json=payload)
        repeated = client.post('/api/tamil/game-answer', json=payload)
        assert first.status_code == repeated.status_code == 200
        assert first.json()['attempt']['correct'] is True
        assert repeated.json()['already_saved'] is True
        changed = {**payload, 'written_text': 'மரம்'} if game == 'word-builder' else {
            **payload, 'selected_id': {'find-letter': 'consonant-la',
                                       'picture-word-match': 'word-appa'}.get(game, 'letter-aa')}
        assert client.post('/api/tamil/game-answer', json=changed).status_code == 409
    progress = client.get('/api/tamil/progress').json()
    assert progress['game_total_attempts'] == len(examples)
    assert len(db.tamil_game_attempts.rows) == len(examples)
    assert all(progress['by_game'][game]['accuracy'] == 100 for game, *_ in examples)


def test_word_game_cannot_claim_picture_without_asset_or_fake_human_audio(setup):
    client, _, _, _ = setup
    for game, item, selected in (
        ('picture-word-match', 'word-eli', 'word-eli'),
        ('listen-choose', 'word-amma', 'word-amma'),
    ):
        result = client.post('/api/tamil/game-answer', json={
            'game_slug': game, 'item_id': item, 'selected_id': selected,
            'request_id': str(uuid4()),
        })
        assert result.status_code == 422


def test_correct_game_rounds_contribute_to_mastery_and_misses_to_review(setup):
    client, _, _, _ = setup
    for _ in range(3):
        result = client.post('/api/tamil/game-answer', json={
            'game_slug': 'letter-match', 'item_id': 'letter-a',
            'selected_id': 'letter-a', 'request_id': str(uuid4()),
        })
        assert result.status_code == 200
    assert 'letter-a' in client.get('/api/tamil/progress').json()['mastered_items']
    missed = client.post('/api/tamil/game-answer', json={
        'game_slug': 'letter-match', 'item_id': 'letter-a',
        'selected_id': 'letter-aa', 'request_id': str(uuid4()),
    })
    assert missed.status_code == 200
    assert 'letter-a' in missed.json()['progress']['review_due_items']

def test_evaluation_rate_limited(setup):
    client, _, _, _ = setup
    for _ in range(tamil.audio_rate_limit.times): assert record(client).status_code == 200
    assert record(client).status_code == 429


@pytest.mark.asyncio
async def test_privacy_export_and_deletion_include_only_callers_tamil_evidence(monkeypatch):
    from app.routers import privacy
    uid, deletion_id = ObjectId(), ObjectId()
    collections = {}
    class Database:
        deletion_requests = SimpleNamespace(find_one=AsyncMock(return_value={'user_id': str(uid)}), update_one=AsyncMock())
        users = SimpleNamespace(delete_one=AsyncMock())
        def __getitem__(self, name):
            if name not in collections:
                rows = [{'user_id': str(uid), 'accuracy': 75}] if name == 'tamil_attempts' else []
                collections[name] = SimpleNamespace(find=Mock(return_value=SimpleNamespace(to_list=AsyncMock(return_value=rows))),
                                                    delete_many=AsyncMock())
            return collections[name]
    db = Database()
    monkeypatch.setattr(privacy, 'get_database', lambda: db)
    response = await privacy.export_my_data({'_id': uid})
    assert json.loads(response.body)['tamil_attempts'][0]['accuracy'] == 75
    collections['tamil_attempts'].find.assert_called_once_with({'user_id': str(uid)})
    await privacy.process_deletion(str(deletion_id), {'role': 'admin'})
    collections['tamil_attempts'].delete_many.assert_awaited_once_with({'user_id': str(uid)})
