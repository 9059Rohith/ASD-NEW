from app.models.clinical_note import ClinicalNoteCreate
from app.routers.clinical_notes import can_access_child, normalize_note


def test_normalize_note_trims_text_and_next_target():
    note = normalize_note(ClinicalNoteCreate(
        text="  Practise slowly.  ",
        next_target="  அம்மா  ",
        caregiver_visible=True,
    ))

    assert note == {
        "text": "Practise slowly.",
        "next_target": "அம்மா",
        "caregiver_visible": True,
    }


def test_normalize_note_converts_empty_next_target_to_none():
    note = normalize_note(ClinicalNoteCreate(
        text="Repeat the sound once.",
        next_target="   ",
    ))

    assert note["next_target"] is None


def test_can_access_child_rejects_unassigned_therapist():
    actor = {"_id": "t1", "role": "therapist"}
    child = {"_id": "c1", "therapist_id": "t2"}

    assert can_access_child(actor, child, write=False) is False
    assert can_access_child(actor, child, write=True) is False


def test_can_access_child_allows_assigned_therapist_to_write():
    actor = {"_id": "t1", "role": "therapist"}
    child = {"_id": "c1", "therapist_id": "t1"}

    assert can_access_child(actor, child, write=True) is True


def test_can_access_child_allows_caregiver_to_read_only_their_profile():
    actor = {"_id": "c1", "role": "user"}
    child = {"_id": "c1", "therapist_id": "t1"}

    assert can_access_child(actor, child, write=False) is True
    assert can_access_child(actor, child, write=True) is False


def test_can_access_child_allows_admin_to_read_and_write():
    actor = {"_id": "a1", "role": "admin"}
    child = {"_id": "c1"}

    assert can_access_child(actor, child, write=False) is True
    assert can_access_child(actor, child, write=True) is True
