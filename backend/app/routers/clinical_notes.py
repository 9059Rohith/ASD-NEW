"""Assigned-child clinical notes with caregiver visibility controls."""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_database
from ..models.clinical_note import ClinicalNoteCreate
from ..utils.jwt_handler import get_current_user


router = APIRouter(prefix="/api/clinical-notes", tags=["clinical-notes"])


def normalize_note(payload: ClinicalNoteCreate) -> dict:
    """Convert a validated note payload into its normalized stored fields."""
    next_target = (payload.next_target or "").strip() or None
    return {
        "text": payload.text.strip(),
        "next_target": next_target,
        "caregiver_visible": payload.caregiver_visible,
    }


def can_access_child(actor: dict, child: dict, *, write: bool) -> bool:
    """Apply the role and assignment boundary for one child profile."""
    role = actor.get("role")
    actor_id = str(actor.get("_id"))
    child_id = str(child.get("_id"))
    if role == "admin":
        return True
    if role == "therapist":
        return child.get("therapist_id") == actor_id
    return role == "user" and not write and actor_id == child_id


def serialize_note(note: dict) -> dict:
    created_at = note.get("created_at")
    return {
        "id": str(note.get("_id", "")),
        "child_id": note.get("child_id"),
        "therapist_id": note.get("therapist_id"),
        "therapist_name": note.get("therapist_name"),
        "text": note.get("text"),
        "next_target": note.get("next_target"),
        "caregiver_visible": bool(note.get("caregiver_visible", False)),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
    }


async def _child_or_404(db, child_id: str) -> dict:
    if not ObjectId.is_valid(child_id):
        raise HTTPException(status_code=400, detail="Invalid child id")
    child = await db.users.find_one({"_id": ObjectId(child_id), "role": "user"})
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found")
    return child


@router.get("/{child_id}")
async def list_clinical_notes(
    child_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    child = await _child_or_404(db, child_id)
    if not can_access_child(current_user, child, write=False):
        raise HTTPException(status_code=403, detail="Not authorized for this child")

    query = {"child_id": child_id}
    if current_user.get("role") == "user":
        query["caregiver_visible"] = True
    notes = await db.clinical_notes.find(query).sort("created_at", -1).limit(100).to_list(length=100)
    return {"notes": [serialize_note(note) for note in notes]}


@router.post("/{child_id}", status_code=status.HTTP_201_CREATED)
async def create_clinical_note(
    child_id: str,
    payload: ClinicalNoteCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    child = await _child_or_404(db, child_id)
    if not can_access_child(current_user, child, write=True):
        raise HTTPException(status_code=403, detail="Only the assigned therapist can add a note")

    note = {
        "child_id": child_id,
        "therapist_id": str(current_user["_id"]),
        "therapist_name": current_user.get("full_name") or "Therapist",
        **normalize_note(payload),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.clinical_notes.insert_one(note)
    note["_id"] = result.inserted_id
    return serialize_note(note)

