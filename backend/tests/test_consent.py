from datetime import datetime, timezone

from app.routers.consent import OPTIONAL_PURPOSES, reduce_consent_records


def _event(purpose: str, granted: bool, month: int, policy_version: str = "2026-08-30"):
    return {
        "purpose": purpose,
        "granted": granted,
        "policy_version": policy_version,
        "created_at": datetime(2026, month, 1, tzinfo=timezone.utc),
    }


def test_reduce_consent_records_uses_latest_event_per_purpose():
    state = reduce_consent_records([
        _event("recording_retention", False, 1),
        _event("recording_retention", True, 2),
    ])

    assert state["recording_retention"] == {
        "granted": True,
        "policy_version": "2026-08-30",
        "updated_at": "2026-02-01T00:00:00+00:00",
    }


def test_reduce_consent_records_is_order_independent():
    state = reduce_consent_records([
        _event("clinician_sharing", True, 5),
        _event("clinician_sharing", False, 3),
    ])

    assert state["clinician_sharing"]["granted"] is True


def test_reduce_consent_records_defaults_optional_purposes_to_denied():
    state = reduce_consent_records([])

    assert set(state) == set(OPTIONAL_PURPOSES)
    assert all(value == {
        "granted": False,
        "policy_version": None,
        "updated_at": None,
    } for value in state.values())


def test_reduce_consent_records_ignores_unknown_purposes():
    state = reduce_consent_records([_event("advertising", True, 1)])

    assert "advertising" not in state
    assert all(value["granted"] is False for value in state.values())
