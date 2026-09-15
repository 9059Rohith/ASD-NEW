"""Appointments router — booking therapy sessions with therapists.

Backs the Appointments page (web + Android). A parent books a slot with a
therapist; the therapist confirms/completes; either side can cancel. Reminders
land in the notification centre.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
from ..database import get_database
from ..utils.jwt_handler import get_current_user, require_therapist, require_admin
from ..utils.mongo import serialize, paginate, oid, audit, now
from .notifications import push_notification

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"]
MODES = ["online", "in_person"]


class AppointmentCreate(BaseModel):
    therapist_id: str
    scheduled_at: datetime
    duration_min: int = Field(default=30, ge=10, le=180)
    mode: str = Field(default="online")
    reason: Optional[str] = Field(default=None, max_length=1000)


class AppointmentReschedule(BaseModel):
    scheduled_at: datetime
    duration_min: Optional[int] = Field(default=None, ge=10, le=180)


class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None


def _is_participant(appt: dict, user: dict) -> bool:
    uid = str(user["_id"])
    return uid in (appt.get("user_id"), appt.get("therapist_id")) or user.get("role") == "admin"


@router.post("")
async def book(payload: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    """Book an appointment with a therapist."""
    db = get_database()
    therapist = await db.users.find_one({"_id": oid(payload.therapist_id)})
    if not therapist or therapist.get("role") not in ("therapist", "admin"):
        raise HTTPException(status_code=404, detail="Therapist not found")
    if payload.scheduled_at < now():
        raise HTTPException(status_code=400, detail="Cannot book a slot in the past")
    # Prevent double-booking the same therapist at the same instant.
    clash = await db.appointments.find_one({
        "therapist_id": str(therapist["_id"]),
        "scheduled_at": payload.scheduled_at,
        "status": {"$in": ["pending", "confirmed"]},
    })
    if clash:
        raise HTTPException(status_code=409, detail="Therapist is not available at that time")
    doc = {
        "user_id": str(current_user["_id"]),
        "user_name": current_user.get("full_name"),
        "child_name": current_user.get("child_name"),
        "therapist_id": str(therapist["_id"]),
        "therapist_name": therapist.get("full_name"),
        "scheduled_at": payload.scheduled_at,
        "duration_min": payload.duration_min,
        "mode": payload.mode if payload.mode in MODES else "online",
        "reason": payload.reason,
        "status": "pending",
        "note": None,
        "created_at": now(),
        "updated_at": now(),
    }
    result = await db.appointments.insert_one(doc)
    await push_notification(
        str(therapist["_id"]), "New appointment request",
        f"{current_user.get('full_name')} requested a session.",
        category="appointment", link="/appointments",
    )
    await audit("appointment.book", current_user, target=str(result.inserted_id))
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.get("")
async def my_appointments(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    upcoming: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """List the caller's appointments (as parent or therapist)."""
    db = get_database()
    uid = str(current_user["_id"])
    query = {"$or": [{"user_id": uid}, {"therapist_id": uid}]}
    if current_user.get("role") == "admin":
        query = {}
    if status in STATUSES:
        query["status"] = status
    if upcoming:
        query["scheduled_at"] = {"$gte": now()}
        if status not in STATUSES:
            query["status"] = {"$in": ["pending", "confirmed"]}
    return await paginate(db.appointments, query, page, limit, sort_field="scheduled_at", sort_dir=1)


@router.get("/available-therapists")
async def available_therapists(current_user: dict = Depends(get_current_user)):
    """List therapists a parent can book with."""
    db = get_database()
    therapists = await db.users.find(
        {"role": "therapist"},
        {"full_name": 1, "email": 1, "avatar_url": 1, "medical": 1},
    ).to_list(length=500)
    return serialize(therapists)


@router.get("/{appointment_id}")
async def get_appointment(appointment_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch a single appointment (participants only)."""
    db = get_database()
    appt = await db.appointments.find_one({"_id": oid(appointment_id)})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not _is_participant(appt, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return serialize(appt)


@router.patch("/{appointment_id}/reschedule")
async def reschedule(appointment_id: str, payload: AppointmentReschedule, current_user: dict = Depends(get_current_user)):
    """Reschedule an appointment to a new time."""
    db = get_database()
    appt = await db.appointments.find_one({"_id": oid(appointment_id)})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not _is_participant(appt, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    if payload.scheduled_at < now():
        raise HTTPException(status_code=400, detail="Cannot reschedule to the past")
    updates = {"scheduled_at": payload.scheduled_at, "status": "pending", "updated_at": now()}
    if payload.duration_min:
        updates["duration_min"] = payload.duration_min
    await db.appointments.update_one({"_id": oid(appointment_id)}, {"$set": updates})
    other = appt["therapist_id"] if str(current_user["_id"]) == appt["user_id"] else appt["user_id"]
    await push_notification(other, "Appointment rescheduled", "A session time has changed.", category="appointment", link="/appointments")
    return serialize(await db.appointments.find_one({"_id": oid(appointment_id)}))


@router.patch("/{appointment_id}/status")
async def update_status(appointment_id: str, payload: StatusUpdate, current_user: dict = Depends(get_current_user)):
    """Confirm / complete / cancel / mark no-show."""
    db = get_database()
    appt = await db.appointments.find_one({"_id": oid(appointment_id)})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not _is_participant(appt, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    if payload.status not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.appointments.update_one(
        {"_id": oid(appointment_id)},
        {"$set": {"status": payload.status, "note": payload.note, "updated_at": now()}},
    )
    other = appt["therapist_id"] if str(current_user["_id"]) == appt["user_id"] else appt["user_id"]
    await push_notification(other, f"Appointment {payload.status}", f"A session is now {payload.status}.", category="appointment", link="/appointments")
    await audit("appointment.status", current_user, target=appointment_id, meta={"status": payload.status})
    return serialize(await db.appointments.find_one({"_id": oid(appointment_id)}))


@router.delete("/{appointment_id}")
async def cancel(appointment_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel (soft — sets status=cancelled) an appointment."""
    db = get_database()
    appt = await db.appointments.find_one({"_id": oid(appointment_id)})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not _is_participant(appt, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    await db.appointments.update_one({"_id": oid(appointment_id)}, {"$set": {"status": "cancelled", "updated_at": now()}})
    return {"message": "Appointment cancelled"}


@router.get("/admin/all")
async def admin_all(page: int = 1, limit: int = 30, status: Optional[str] = None, current_admin: dict = Depends(require_admin)):
    """Admin: list every appointment."""
    db = get_database()
    query = {"status": status} if status in STATUSES else {}
    return await paginate(db.appointments, query, page, limit, sort_field="scheduled_at", sort_dir=-1)
