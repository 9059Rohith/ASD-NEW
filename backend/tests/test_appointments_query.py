from types import SimpleNamespace

import pytest

from app.routers import appointments


@pytest.mark.asyncio
async def test_upcoming_appointments_exclude_concluded_statuses(monkeypatch):
    captured = {}

    async def paginate(_collection, query, page, limit, **kwargs):
        captured.update(query)
        return {'items': [], 'page': page, 'limit': limit}

    monkeypatch.setattr(appointments, 'get_database', lambda: SimpleNamespace(appointments=object()))
    monkeypatch.setattr(appointments, 'paginate', paginate)

    await appointments.my_appointments(upcoming=True, current_user={'_id': 'parent-1', 'role': 'user'})

    assert captured['status'] == {'$in': ['pending', 'confirmed']}
    assert '$gte' in captured['scheduled_at']
