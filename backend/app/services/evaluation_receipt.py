"""Short-lived, user-bound proof of a server-computed speech result."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import jwt
from fastapi import HTTPException
from ..config import settings


def issue_receipt(user_id: str, result: dict) -> str:
    return jwt.encode({'sub': user_id, 'aud': 'speech-progress', 'jti': str(uuid4()),
                       'exp': datetime.now(timezone.utc) + timedelta(hours=24), 'result': result},
                      settings.JWT_SECRET_KEY, algorithm='HS256')


def verify_receipt(token: str, user_id: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=['HS256'],
                             audience='speech-progress', options={'require': ['sub', 'exp', 'jti', 'result']})
    except jwt.PyJWTError as exc:
        raise HTTPException(422, 'A valid server evaluation receipt is required. Record a new attempt.') from exc
    if payload['sub'] != user_id:
        raise HTTPException(403, 'This evaluation belongs to another account.')
    return payload
