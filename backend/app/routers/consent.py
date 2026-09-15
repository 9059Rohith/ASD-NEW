"""Append-only caregiver consent ledger for optional child voice-data uses."""
from datetime import datetime, timezone
from typing import Iterable

from fastapi import APIRouter, Depends

from ..database import get_database
from ..models.consent import ConsentUpdate
from ..utils.jwt_handler import get_current_user


router = APIRouter(prefix="/api/consent", tags=["consent"])

OPTIONAL_PURPOSES = (
    "recording_retention",
    "clinician_sharing",
    "deidentified_research",
)


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def reduce_consent_records(records: Iterable[dict]) -> dict:
    """Return the newest decision for each supported optional purpose."""
    current = {
        purpose: {"granted": False, "policy_version": None, "updated_at": None}
        for purpose in OPTIONAL_PURPOSES
    }
    newest = {purpose: None for purpose in OPTIONAL_PURPOSES}

    for record in records:
        purpose = record.get("purpose")
        if purpose not in current:
            continue
        created_at = record.get("created_at")
        if newest[purpose] is not None and (
            created_at is None or created_at <= newest[purpose]
        ):
            continue
        newest[purpose] = created_at
        current[purpose] = {
            "granted": bool(record.get("granted", False)),
            "policy_version": record.get("policy_version"),
            "updated_at": _iso(created_at),
        }
    return current


def _response(records: Iterable[dict]) -> dict:
    return {
        "purposes": reduce_consent_records(records),
        "processing_location": "edge_preferred",
        "raw_audio_default": "transient",
        "policy_version": "2026-08-30",
    }


@router.get("")
async def get_consent(current_user: dict = Depends(get_current_user)):
    """Return current optional-consent state for the caregiver account."""
    db = get_database()
    records = await db.consent_records.find({
        "user_id": str(current_user["_id"]),
    }).to_list(length=500)
    return _response(records)


@router.put("")
async def update_consent(
    payload: ConsentUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Append one consent event and return the resulting current state."""
    db = get_database()
    user_id = str(current_user["_id"])
    event = {
        "user_id": user_id,
        "purpose": payload.purpose,
        "granted": payload.granted,
        "policy_version": payload.policy_version,
        "actor_role": current_user.get("role", "user"),
        "created_at": datetime.now(timezone.utc),
    }
    await db.consent_records.insert_one(event)
    records = await db.consent_records.find({"user_id": user_id}).to_list(length=500)
    return _response(records)

