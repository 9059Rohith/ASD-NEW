from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.routers import calendar


class Collection:
    def __init__(self, rows):
        self.rows = rows
        self.query = None

    def find(self, query):
        self.query = query
        return self

    def sort(self, *_args):
        return self

    async def to_list(self, *, length):
        return self.rows[:length]


@pytest.mark.asyncio
async def test_calendar_includes_completed_and_missed_appointments(monkeypatch):
    when = datetime(2026, 9, 14, 10, tzinfo=timezone.utc)
    events = Collection([])
    appointments = Collection([
        {'_id': 'done-1', 'user_id': 'parent-1', 'therapist_name': 'Clinician',
         'scheduled_at': when, 'duration_min': 30, 'status': 'completed'},
        {'_id': 'missed-1', 'user_id': 'parent-1', 'therapist_name': 'Clinician',
         'scheduled_at': when, 'duration_min': 30, 'status': 'no_show'},
    ])
    monkeypatch.setattr(calendar, 'get_database', lambda: SimpleNamespace(
        calendar_events=events, appointments=appointments))

    result = await calendar.list_events(current_user={'_id': 'parent-1'})

    assert [item['status'] for item in result['events']] == ['completed', 'no_show']
    assert [item['done'] for item in result['events']] == [True, False]
    assert set(appointments.query['status']['$in']) == {
        'pending', 'confirmed', 'completed', 'no_show'}
