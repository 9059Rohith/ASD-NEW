import jwt
import pytest
from fastapi import HTTPException
from app.services.evaluation_receipt import issue_receipt, verify_receipt


def test_receipt_preserves_server_evidence_and_rejects_cross_user_access():
    evidence = {'accuracy': 33.33, 'lesson_id': 14, 'actual_phonemes': ['u'], 'scorable': True}
    token = issue_receipt('child-1', evidence)
    assert verify_receipt(token, 'child-1')['result'] == evidence
    with pytest.raises(HTTPException) as exc:
        verify_receipt(token, 'child-2')
    assert exc.value.status_code == 403


def test_forged_and_missing_receipts_are_rejected():
    for token in ['', jwt.encode({'sub': 'child-1'}, 'attacker', algorithm='HS256')]:
        with pytest.raises(HTTPException):
            verify_receipt(token, 'child-1')
