from bson import ObjectId
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routers import progress
from app.routers.progress import serialize_progress_documents


def test_progress_summary_documents_are_json_safe_without_losing_evidence():
    document_id = ObjectId()
    rows = serialize_progress_documents([
        {
            "_id": document_id,
            "user_id": "child-1",
            "lesson_id": 5,
            "best_accuracy": 64.0,
            "attempts": 2,
        }
    ])

    assert rows == [{
        "_id": str(document_id),
        "user_id": "child-1",
        "lesson_id": 5,
        "best_accuracy": 64.0,
        "attempts": 2,
    }]


class SummaryCursor:
    def __init__(self, rows): self.rows = list(rows)
    def sort(self, *_args): return self
    def limit(self, limit): self.rows = self.rows[:limit]; return self
    async def to_list(self, length): return self.rows[:length]


class SummaryCollection:
    def __init__(self, rows): self.rows = rows; self.queries = []
    def find(self, query):
        self.queries.append(query)
        return SummaryCursor([row for row in self.rows if row['user_id'] == query['user_id']])
    async def aggregate(self, pipeline):
        query = pipeline[0]['$match']; self.queries.append(query)
        rows = [row for row in self.rows if row['user_id'] == query['user_id']]
        return SummaryCursor([{'total_sessions': len(rows), 'total_stars': sum(row['stars_earned'] for row in rows)}] if rows else [])


def summary_database(monkeypatch, owner, *, count=1):
    rows = [{'_id': f'ev-{i}', 'user_id': owner, 'lesson_id': 1,
             'accuracy': 80, 'stars_earned': 2, 'created_at': datetime.now(timezone.utc)} for i in range(count)]
    db = SimpleNamespace(users=SimpleNamespace(find_one=AsyncMock(return_value=None)),
                         progress=SummaryCollection([]), evaluations=SummaryCollection(rows))
    monkeypatch.setattr(progress, 'get_database', lambda: db)
    return db


@pytest.mark.asyncio
async def test_summary_for_virtual_demo_identity_uses_real_saved_evidence(monkeypatch):
    # Demo authentication legitimately returns a string identity with no users row.
    owner = '000000000000000000000001'
    summary_database(monkeypatch, owner)
    result = await progress.get_progress_summary('me', {'_id': owner, 'is_demo': True})
    assert result['total_sessions'] == 1
    assert result['total_stars'] == 2
    assert result['chart_data'][0]['accuracy'] == 80


@pytest.mark.asyncio
async def test_summary_empty_missing_account_has_no_fabricated_totals(monkeypatch):
    summary_database(monkeypatch, 'child-1', count=0)
    result = await progress.get_progress_summary('me', {'_id': 'child-1', 'total_sessions': 999, 'total_stars': 999})
    assert result['total_sessions'] == result['total_stars'] == 0
    assert result['chart_data'] == []


@pytest.mark.asyncio
async def test_summary_admin_target_totals_do_not_use_admin_account(monkeypatch):
    target = str(ObjectId())
    db = summary_database(monkeypatch, target, count=12)
    db.users.find_one.return_value = {'total_sessions': 200, 'total_stars': 600}
    result = await progress.get_progress_summary(target, {'_id': ObjectId(), 'role': 'admin'})
    assert result['total_sessions'] == 12
    assert result['total_stars'] == 24
    assert len(result['chart_data']) == 10
    assert all(query == {'user_id': target} for query in db.evaluations.queries)


@pytest.mark.asyncio
async def test_summary_does_not_allow_cross_owner_requests(monkeypatch):
    db = summary_database(monkeypatch, 'other-child')
    with pytest.raises(HTTPException) as error:
        await progress.get_progress_summary('other-child', {'_id': 'child-1', 'role': 'user'})
    assert error.value.status_code == 403
    assert not db.evaluations.queries
