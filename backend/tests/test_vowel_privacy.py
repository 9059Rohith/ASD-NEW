"""Vowel evidence participates in the existing account privacy lifecycle."""
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from bson import ObjectId
import pytest

from app.routers import privacy


@pytest.mark.asyncio
async def test_export_includes_only_callers_vowel_sessions_and_strips_secrets(monkeypatch):
    uid = ObjectId()
    collections = {}

    def collection(name):
        if name not in collections:
            rows = [{'user_id': str(uid), 'attempts': [{'accuracy': 94}]}] if name == 'vowel_sessions' else []
            collections[name] = SimpleNamespace(find=Mock(return_value=SimpleNamespace(to_list=AsyncMock(return_value=rows))))
        return collections[name]

    class Database:
        __getitem__ = lambda self, name: collection(name)

    monkeypatch.setattr(privacy, 'get_database', lambda: Database())
    response = await privacy.export_my_data({'_id': uid, 'email': 'owner@example.invalid', 'password_hash': 'secret'})
    bundle = json.loads(response.body)
    assert bundle['vowel_sessions'][0]['attempts'][0]['accuracy'] == 94
    assert 'password_hash' not in bundle['profile']
    assert all(coll.find.call_args.args == ({'user_id': str(uid)},) for coll in collections.values())


@pytest.mark.asyncio
async def test_processed_account_deletion_removes_only_callers_vowel_evidence(monkeypatch):
    uid, request_id = ObjectId(), ObjectId()
    collections = {}

    class Database:
        deletion_requests = SimpleNamespace(find_one=AsyncMock(return_value={'user_id': str(uid)}), update_one=AsyncMock())
        users = SimpleNamespace(delete_one=AsyncMock())

        def __getitem__(self, name):
            return collections.setdefault(name, SimpleNamespace(delete_many=AsyncMock()))

    db = Database()
    monkeypatch.setattr(privacy, 'get_database', lambda: db)
    await privacy.process_deletion(str(request_id), {'role': 'admin'})
    collections['vowel_sessions'].delete_many.assert_awaited_once_with({'user_id': str(uid)})
    db.users.delete_one.assert_awaited_once_with({'_id': uid})
    assert db.deletion_requests.update_one.call_args.args[1]['$set']['status'] == 'processed'
