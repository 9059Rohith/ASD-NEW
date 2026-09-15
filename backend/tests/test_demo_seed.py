from datetime import datetime, timezone
from pathlib import Path
import os
import subprocess
import sys

from app.demo_seed import CAREGIVER_ID, THERAPIST_ID, build_demo_documents, build_demo_reset_filters


def test_demo_seed_script_bootstraps_backend_import_path():
    backend_root = Path(__file__).resolve().parents[1]
    environment = {
        **os.environ,
        "APP_ENV": "production",
        "JWT_SECRET_KEY": "a-production-test-secret-with-32-chars",
        "ADMIN_PASSWORD": "production-test-password",
        "COOKIE_SECURE": "true",
        "CORS_ORIGINS": "https://example.test",
    }

    result = subprocess.run(
        [sys.executable, "scripts/seed_demo_care_loop.py"],
        cwd=backend_root,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "Demo data is disabled in production" in (result.stdout + result.stderr)


def test_demo_reset_filters_are_scoped_to_fixed_demo_identities():
    filters = build_demo_reset_filters()

    assert filters == {
        "evaluations": {"user_id": str(CAREGIVER_ID)},
        "progress": {"user_id": str(CAREGIVER_ID)},
        "consent_records": {"user_id": str(CAREGIVER_ID)},
        "clinical_notes": {
            "child_id": str(CAREGIVER_ID),
            "therapist_id": str(THERAPIST_ID),
        },
    }


def test_demo_seed_links_therapist_child_scores_consent_and_note():
    docs = build_demo_documents(
        datetime(2026, 8, 30, 9, 0, tzinfo=timezone.utc),
        password_hash="hashed-for-test",
    )

    caregiver, therapist = docs["users"]
    assert caregiver["role"] == "user"
    assert therapist["role"] == "therapist"
    assert caregiver["therapist_id"] == str(therapist["_id"])
    assert all(row["user_id"] == str(caregiver["_id"]) for row in docs["evaluations"])
    assert {row["lesson_id"] for row in docs["progress"]} == {1, 2, 5}
    assert all(row["user_id"] == str(caregiver["_id"]) for row in docs["progress"])
    assert all(row["user_id"] == str(caregiver["_id"]) for row in docs["consent_records"])
    assert docs["clinical_notes"][0]["child_id"] == str(caregiver["_id"])


def test_demo_seed_contains_tamil_gop_provenance_and_no_raw_audio():
    docs = build_demo_documents(
        datetime(2026, 8, 30, 9, 0, tzinfo=timezone.utc),
        password_hash="hashed-for-test",
    )

    targets = {row["phoneme"] for row in docs["evaluations"]}
    assert {"அ", "ஆ", "அம்மா"}.issubset(targets)
    assert all(row["validation_source"] in {"local", "server_gop"} for row in docs["evaluations"])
    assert all("audio" not in key.lower() for rows in docs.values() for row in rows for key in row)


def test_demo_seed_denies_optional_audio_retention_and_research_by_default():
    docs = build_demo_documents(
        datetime(2026, 8, 30, 9, 0, tzinfo=timezone.utc),
        password_hash="hashed-for-test",
    )
    consent = {row["purpose"]: row["granted"] for row in docs["consent_records"]}

    assert consent == {
        "recording_retention": False,
        "clinician_sharing": True,
        "deidentified_research": False,
    }
