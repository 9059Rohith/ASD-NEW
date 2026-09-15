"""Deterministic, privacy-safe demonstration documents for the care loop."""
from datetime import datetime, timedelta

from bson import ObjectId


CAREGIVER_ID = ObjectId("000000000000000000000101")
THERAPIST_ID = ObjectId("000000000000000000000102")


def build_demo_reset_filters() -> dict[str, dict]:
    """Return narrow filters used to restore only the fixed demo care loop."""
    caregiver_id = str(CAREGIVER_ID)
    return {
        "evaluations": {"user_id": caregiver_id},
        "progress": {"user_id": caregiver_id},
        "consent_records": {"user_id": caregiver_id},
        "clinical_notes": {
            "child_id": caregiver_id,
            "therapist_id": str(THERAPIST_ID),
        },
    }


def build_demo_documents(now: datetime, *, password_hash: str) -> dict[str, list[dict]]:
    """Build linked demo records without storing voice recordings."""
    caregiver_id = str(CAREGIVER_ID)
    therapist_id = str(THERAPIST_ID)
    users = [
        {
            "_id": CAREGIVER_ID,
            "email": "meena.caregiver@asd-edge-st.demo",
            "password_hash": password_hash,
            "full_name": "Meena Raman",
            "child_name": "Kavi",
            "child_age": 7,
            "language": "Tamil",
            "role": "user",
            "therapist_id": therapist_id,
            "created_at": now - timedelta(days=90),
            "last_login": now,
            "total_sessions": 12,
            "total_stars": 36,
            "is_demo_seed": True,
        },
        {
            "_id": THERAPIST_ID,
            "email": "therapist@asd-edge-st.demo",
            "password_hash": password_hash,
            "full_name": "Dr. Venkataraman D",
            "child_name": None,
            "child_age": None,
            "language": "Tamil",
            "role": "therapist",
            "created_at": now - timedelta(days=90),
            "last_login": now,
            "total_sessions": 0,
            "total_stars": 0,
            "is_demo_seed": True,
        },
    ]

    targets = [
        ("அ", 88.0, 86.0, "local", 1),
        ("ஆ", 76.0, 74.0, "server_gop", 2),
        ("அம்மா", 64.0, 61.0, "server_gop", 5),
        ("அ", 82.0, 80.0, "local", 1),
        ("அம்மா", 59.0, 57.0, "server_gop", 5),
        ("ஆ", 71.0, 69.0, "server_gop", 2),
    ]
    evaluations = []
    for index, (phoneme, accuracy, gop, source, lesson_id) in enumerate(targets):
        evaluations.append({
            "_id": ObjectId(f"0000000000000000000002{index + 1:02d}"),
            "user_id": caregiver_id,
            "lesson_id": lesson_id,
            "phoneme": phoneme,
            "lesson_type": "word" if phoneme == "அம்மா" else "letter",
            "accuracy": accuracy,
            "phoneme_match": accuracy >= 70,
            "mfcc_score": max(0.0, accuracy - 3),
            "gop_score": gop,
            "airflow_score": round(min(0.95, accuracy / 100), 2),
            "stars_earned": 3 if accuracy >= 80 else 2 if accuracy >= 65 else 1,
            "feedback": "Good effort. Practise the target slowly once more.",
            "duration_ms": 1800,
            "validation_status": "validated" if accuracy >= 70 else "not_matched",
            "validation_source": source,
            "weakest_syllable": "ம்மா" if phoneme == "அம்மா" else None,
            "syllable_scores": (
                [{"syllable": "அம்", "score": 0.72}, {"syllable": "ம்மா", "score": gop / 100}]
                if phoneme == "அம்மா" else []
            ),
            "created_at": now - timedelta(days=(5 - index) * 7),
        })

    progress = [
        {
            "_id": ObjectId("000000000000000000000501"),
            "user_id": caregiver_id,
            "lesson_id": 1,
            "best_accuracy": 88.0,
            "attempts": 2,
            "stars_best": 3,
            "completed": True,
            "last_attempted": now - timedelta(days=14),
        },
        {
            "_id": ObjectId("000000000000000000000502"),
            "user_id": caregiver_id,
            "lesson_id": 2,
            "best_accuracy": 76.0,
            "attempts": 2,
            "stars_best": 2,
            "completed": True,
            "last_attempted": now - timedelta(days=7),
        },
        {
            "_id": ObjectId("000000000000000000000503"),
            "user_id": caregiver_id,
            "lesson_id": 5,
            "best_accuracy": 64.0,
            "attempts": 2,
            "stars_best": 1,
            "completed": True,
            "last_attempted": now,
        },
    ]

    consent_records = [
        {
            "_id": ObjectId("000000000000000000000301"),
            "user_id": caregiver_id,
            "purpose": "recording_retention",
            "granted": False,
            "policy_version": "2026-08-30",
            "actor_role": "user",
            "created_at": now - timedelta(days=30),
        },
        {
            "_id": ObjectId("000000000000000000000302"),
            "user_id": caregiver_id,
            "purpose": "clinician_sharing",
            "granted": True,
            "policy_version": "2026-08-30",
            "actor_role": "user",
            "created_at": now - timedelta(days=30),
        },
        {
            "_id": ObjectId("000000000000000000000303"),
            "user_id": caregiver_id,
            "purpose": "deidentified_research",
            "granted": False,
            "policy_version": "2026-08-30",
            "actor_role": "user",
            "created_at": now - timedelta(days=30),
        },
    ]
    clinical_notes = [{
        "_id": ObjectId("000000000000000000000401"),
        "child_id": caregiver_id,
        "therapist_id": therapist_id,
        "therapist_name": "Dr. Venkataraman D",
        "text": "Practise அம்மா slowly. Keep the session under 10 minutes.",
        "next_target": "அம்மா",
        "caregiver_visible": True,
        "created_at": now - timedelta(days=1),
    }]
    return {
        "users": users,
        "evaluations": evaluations,
        "progress": progress,
        "consent_records": consent_records,
        "clinical_notes": clinical_notes,
    }
