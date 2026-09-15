"""Vowel sessions preserve server ownership and derive rewards from evidence."""
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import vowels
from app.services.vowel_progress import build_progress
from app.services.vowel_progress import rewards
from app.utils.jwt_handler import get_current_user


class Cursor:
    def __init__(self, rows): self.rows = deepcopy(rows)
    def sort(self, key, direction):
        self.rows.sort(key=lambda row: row[key], reverse=direction < 0)
        return self
    def limit(self, n): self.rows = self.rows[:n]; return self
    def skip(self, n): self.rows = self.rows[n:]; return self
    async def to_list(self, length): return self.rows[:length]
    def __aiter__(self): self.iterator = iter(self.rows); return self
    async def __anext__(self):
        try: return next(self.iterator)
        except StopIteration: raise StopAsyncIteration


class Collection:
    def __init__(self): self.rows = []
    def matches(self, row, query): return all(row.get(k) == v for k, v in query.items())
    async def insert_one(self, row): self.rows.append(deepcopy(row))
    async def find_one(self, query): return next((deepcopy(r) for r in self.rows if self.matches(r, query)), None)
    def find(self, query): return Cursor([r for r in self.rows if self.matches(r, query)])
    async def count_documents(self, query): return sum(self.matches(row, query) for row in self.rows)
    async def aggregate(self, pipeline, **kwargs):
        selected = [row for row in self.rows if self.matches(row, pipeline[0]['$match'])]
        if '$group' in pipeline[1]:
            if not selected: return Cursor([])
            grouped = {'_id': None}
            for key, expression in pipeline[1]['$group'].items():
                if key == '_id': continue
                operation, field = next(iter(expression.items()))
                values = [row.get(field[1:], 0) if isinstance(field, str) else field for row in selected]
                # Mongo stores dates as UTC milliseconds and returns naive UTC
                # with this application's default codec options.
                values = [value.astimezone(timezone.utc).replace(tzinfo=None) if isinstance(value, datetime) and value.tzinfo else value for value in values]
                grouped[key] = sum(values) if operation == '$sum' else max(values)
            return Cursor([grouped])
        rows = [attempt for row in selected for attempt in row['attempts']]
        return Cursor(sorted(rows, key=lambda row: (row['created_at'], row['id'])))
    async def update_one(self, query, change, upsert=False):
        row = next((r for r in self.rows if self.matches(r, query)), None)
        inserted = row is None and upsert
        if row is None:
            if not upsert: return SimpleNamespace(modified_count=0)
            row = deepcopy(query); row.update(deepcopy(change.get('$setOnInsert', {}))); self.rows.append(row)
        row.update(deepcopy(change.get('$set', {})))
        for key, value in change.get('$max', {}).items():
            if key not in row or value > row[key]: row[key] = deepcopy(value)
        return SimpleNamespace(modified_count=1, upserted_id=row.get('_id') if inserted else None)


@pytest.fixture
def setup(monkeypatch):
    vowels.audio_rate_limit._hits.clear()
    db = SimpleNamespace(vowel_sessions=Collection(), evaluations=Collection(), progress=Collection(), users=Collection())
    db.users.rows.append({'_id': 'child-1'})
    monkeypatch.setattr(vowels, 'get_database', lambda: db)
    monkeypatch.setattr(vowels, 'analyze_audio', lambda *_: {
        'accuracy': 91, 'scorable': True, 'feedback': 'Clear vowel',
        'debug_features': {'private': 1}, 'vowel_analysis': {'identity': 'A', 'length': 'short'},
        'score_components': {'identity': 40, 'duration': 30, 'pronunciation': 15, 'consistency': 6},
    })
    app = FastAPI(); app.include_router(vowels.router)
    app.dependency_overrides[get_current_user] = lambda: {'_id': 'child-1'}
    with TestClient(app) as client: yield client, db, app


def create(client, mode='practice'):
    response = client.post('/api/vowels/sessions', json={'mode': mode})
    assert response.status_code == 201, response.text
    return response.json()


def record(client, session, index=0, request_id='one', target=None):
    return client.post('/api/vowels/analyze', data={
        'session_id': session['id'], 'challenge_index': index, 'request_id': request_id,
        'target_phoneme': target or session['challenges'][index]['target_phoneme'],
    }, files={'audio': ('take.wav', b'wave', 'audio/wav')})


def test_authentication_required():
    app = FastAPI(); app.include_router(vowels.router)
    with TestClient(app) as client:
        assert client.get('/api/vowels/catalog').status_code == 401
        assert client.get('/api/vowels/progress').status_code == 401


def test_perfect_sound_has_distinct_reward_and_success_boundary():
    assert rewards(50)['success'] is False
    assert rewards(50.01)['success'] is True
    assert rewards(95, {'identity_match': True, 'length_match': False}) == {
        'success': False, 'celebration': None, 'stars_earned': 0, 'xp_earned': 2,
    }
    assert rewards(90)['celebration'] == 'excellent'
    assert rewards(100)['celebration'] == 'perfect'
    assert rewards(100)['xp_earned'] > rewards(99)['xp_earned']


def test_owner_forged_target_and_out_of_order(setup):
    client, db, app = setup
    session = create(client, 'evaluate')
    assert record(client, session, target='forged').status_code == 422
    assert record(client, session, index=1).status_code == 409
    app.dependency_overrides[get_current_user] = lambda: {'_id': 'another-child'}
    assert record(client, session).status_code == 404
    assert client.post(f"/api/vowels/sessions/{session['id']}/complete").status_code == 404
    assert not db.evaluations.rows


def test_replay_cannot_farm_rewards_and_debug_is_private(setup):
    client, db, _ = setup; session = create(client)
    first = record(client, session).json()
    repeated = record(client, session).json()
    assert first['progress']['scored_attempts'] == 1
    assert repeated['already_saved'] is True
    assert first['progress'] == repeated['progress']
    assert 'debug_features' not in first['result']
    assert len(db.evaluations.rows) == 1
    assert len(db.vowel_sessions.rows[0]['attempts']) == 1
    assert 'audio' not in db.vowel_sessions.rows[0]['attempts'][0]
    assert b'wave' not in db.vowel_sessions.rows[0]['attempts'][0].values()


def test_evaluation_requires_ten_unique_sequential_classes(setup):
    client, db, _ = setup; session = create(client, 'evaluate')
    assert len(set(c['target_phoneme'] for c in session['challenges'])) == 10
    url = f"/api/vowels/sessions/{session['id']}/complete"
    assert client.post(url).status_code == 409
    for index in range(10): assert record(client, session, index, str(index)).status_code == 200
    complete = client.post(url)
    assert complete.status_code == 200, complete.text
    assert complete.json()['summary']['challenge_count'] == 10
    assert complete.json()['progress']['scored_attempts'] == 10
    assert client.post(url).json() == complete.json()


def test_listening_is_not_acoustic_mastery(setup):
    client, _, _ = setup; session = create(client, 'match-sound'); challenge = session['challenges'][0]
    response = client.post(f"/api/vowels/sessions/{session['id']}/answer", json={
        'challenge_index': 0, 'identity': challenge['identity'], 'length': challenge['length'], 'request_id': 'listen',
    })
    assert response.status_code == 200, response.text
    progress = response.json()['progress']
    assert progress['listening']['correct'] == 1
    assert progress['scored_attempts'] == 0
    assert progress['average_score'] is None
    assert record(client, session).status_code == 422


def test_streak_threshold_mastery_and_unscorable_are_truthful():
    rows = [{'id': str(i), 'kind': 'speech', 'target_phoneme': 'a', 'scorable': score is not None,
             'accuracy': score, 'created_at': str(i)} for i, score in enumerate([90, 90, 90, 50, None, 51])]
    progress = build_progress(rows)
    assert progress['current_streak'] == 1
    assert progress['longest_streak'] == 3
    assert progress['scored_attempts'] == 5
    assert progress['total_attempts'] == 6
    assert progress['mastered_classes'] == 0
    assert progress['level'] == 'Beginner'


def test_real_retry_keeps_history_but_replay_does_not(setup):
    client, db, _ = setup; session = create(client)
    assert record(client, session).status_code == 200
    second = record(client, session, request_id='new-recording').json()
    assert second['next_index'] == 1
    assert second['progress']['scored_attempts'] == 2
    assert len(db.evaluations.rows) == 2
    complete = client.post(f"/api/vowels/sessions/{session['id']}/complete").json()
    assert complete['summary']['challenge_count'] == 1
    assert complete['summary']['component_averages']['identity'] == 40
    assert record(client, session, request_id='after-completion').status_code == 409


def test_unscorable_retries_do_not_advance_or_reset_success_streak(setup, monkeypatch):
    client, _, _ = setup; session = create(client)
    monkeypatch.setattr(vowels, 'analyze_audio', lambda *_: {'accuracy': 0, 'scorable': False, 'validation_status': 'no_speech'})
    result = record(client, session).json()
    assert result['result']['accuracy'] is None
    assert result['next_index'] == 0
    assert result['progress']['xp'] == 0
    assert result['progress']['scored_attempts'] == 0
    assert client.post(f"/api/vowels/sessions/{session['id']}/complete").status_code == 409


def test_media_limits_and_payload_ownership(setup, monkeypatch):
    client, _, _ = setup; session = create(client)
    assert client.post('/api/vowels/sessions', json={'mode': 'practice', 'user_id': 'other'}).status_code == 422
    monkeypatch.setattr(vowels.settings, 'MAX_UPLOAD_BYTES', 2)
    assert record(client, session).status_code == 413
    fields = {'session_id': session['id'], 'challenge_index': 0, 'target_phoneme': 'a'}
    assert client.post('/api/vowels/analyze', data=fields, files={'audio': ('x.txt', b'x', 'text/plain')}).status_code == 415
    assert client.post('/api/vowels/analyze', data=fields, files={'audio': ('x.wav', b'', 'audio/wav')}).status_code == 400


def test_request_id_cannot_be_reused_for_a_different_challenge(setup):
    client, _, _ = setup; session = create(client, 'vowel-catch')
    assert record(client, session).status_code == 200
    assert record(client, session, index=1).status_code == 409


def test_mastery_requires_all_classes_and_recent_evidence():
    from app.services.vowel_progress import TARGETS
    rows = [{'id': f'{target}-{i}', 'kind': 'speech', 'target_phoneme': target, 'scorable': True,
             'accuracy': 85, 'created_at': f'{i}'} for target in TARGETS for i in range(3)]
    progress = build_progress(rows)
    assert progress['mastered_classes'] == 10
    assert progress['level'] == 'Vowel Master'
    assert progress['longest_streak'] == 30


def test_simultaneous_replay_is_saved_only_once(setup, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    client, db, _ = setup; session = create(client); barrier = Barrier(2)
    def synchronized_analysis(*_):
        barrier.wait(timeout=10)
        return {'accuracy': 80, 'scorable': True}
    monkeypatch.setattr(vowels, 'analyze_audio', synchronized_analysis)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: record(client, session), range(2)))
    assert [response.status_code for response in responses] == [200, 200]
    assert sorted(response.json()['already_saved'] for response in responses) == [False, True]
    assert len(db.vowel_sessions.rows[0]['attempts']) == 1
    assert len(db.evaluations.rows) == 1


def test_evaluation_new_request_id_cannot_replace_a_scored_challenge(setup):
    client, db, _ = setup; session = create(client, 'evaluate')
    first = record(client, session).json()
    retry = record(client, session, request_id='replacement').json()
    assert retry['already_saved'] is True
    assert retry['result']['id'] == first['result']['id']
    assert len(db.vowel_sessions.rows[0]['attempts']) == 1


def test_wrong_vowel_length_is_not_a_legacy_phoneme_match(setup, monkeypatch):
    client, db, _ = setup; session = create(client)
    monkeypatch.setattr(vowels, 'analyze_audio', lambda *_: {
        'accuracy': 60, 'scorable': True,
        'vowel_analysis': {'identity_match': True, 'length_match': False},
    })
    assert record(client, session).status_code == 200
    assert db.evaluations.rows[0]['phoneme_match'] is False
    db.evaluations.rows[0]['phoneme_match'] = True
    assert record(client, session).status_code == 200
    assert db.evaluations.rows[0]['phoneme_match'] is False


def test_retry_repairs_legacy_aggregates_without_duplicate_rewards(setup):
    client, db, _ = setup; session = create(client)
    first = record(client, session).json()
    assert len(db.progress.rows) == 1
    assert db.progress.rows[0]['attempts'] == 1
    assert db.progress.rows[0]['best_accuracy'] == 91
    assert db.users.rows[0]['total_sessions'] == 1
    assert db.users.rows[0]['total_stars'] == first['result']['stars_earned']
    # Simulate interruption after evidence was inserted but before derived writes.
    db.progress.rows.clear()
    db.users.rows[0].update(total_sessions=0, total_stars=0)
    retry = record(client, session).json()
    assert retry['already_saved'] is True
    assert len(db.evaluations.rows) == 1
    assert db.progress.rows[0]['attempts'] == 1
    assert db.users.rows[0]['total_sessions'] == 1
    assert db.users.rows[0]['total_stars'] == first['result']['stars_earned']
    second = record(client, session, request_id='new-evidence').json()
    assert db.progress.rows[0]['attempts'] == 2
    assert db.users.rows[0]['total_sessions'] == 2
    assert db.users.rows[0]['total_stars'] == 2 * first['result']['stars_earned']
    assert second['progress']['scored_attempts'] == 2


def test_legacy_and_vowel_evidence_share_aggregates_with_objectid_account(setup, monkeypatch):
    from bson import ObjectId
    from app.routers import progress
    from app.services.evaluation_receipt import issue_receipt
    client, db, app = setup
    account_id = ObjectId()
    db.users.rows = [{'_id': account_id}, {'_id': 'unrelated-user', 'total_sessions': 7}]
    app.dependency_overrides[get_current_user] = lambda: {'_id': account_id}
    app.include_router(progress.router)
    monkeypatch.setattr(progress, 'get_database', lambda: db)
    legacy_result = {'scorable': True, 'accuracy': 70, 'lesson_id': 1, 'target_phoneme': 'a'}
    receipt = issue_receipt(str(account_id), legacy_result)
    saved = client.post('/api/progress/save', json={'evaluation_receipt': receipt})
    assert saved.status_code == 200, saved.text
    assert saved.json()['already_saved'] is False
    legacy_progress_id = db.progress.rows[0]['_id']
    session = create(client)
    assert record(client, session).status_code == 200
    assert len(db.progress.rows) == 1
    assert db.progress.rows[0]['_id'] == legacy_progress_id
    assert db.progress.rows[0]['attempts'] == 2
    assert db.users.rows[0]['total_sessions'] == 2
    assert db.users.rows[0]['total_stars'] == saved.json()['stars_earned'] + 3
    assert db.users.rows[1]['total_sessions'] == 7
    # The legacy receipt endpoint also repairs aggregates on replay.
    db.users.rows[0]['total_sessions'] = 0
    replay = client.post('/api/progress/save', json={'evaluation_receipt': receipt})
    assert replay.status_code == 200, replay.text
    assert replay.json()['already_saved'] is True
    assert db.users.rows[0]['total_sessions'] == 2
    assert len(db.evaluations.rows) == 2
