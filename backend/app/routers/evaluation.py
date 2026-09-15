"""Speech and face evaluation endpoints."""
from datetime import datetime, timezone

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, status
from starlette.concurrency import run_in_threadpool

from ..config import settings
from ..curriculum import LESSON_PHONEMES
from ..services.face_analyzer import face_analyzer
from ..services.phoneme_pipeline import phoneme_evaluator as speech_evaluator
from ..services.phoneme_pipeline import AcousticStoryEvaluator
from ..services.vowel_analysis import analyze_vowel
from ..services.diphthong_analysis import analyze_diphthong
from ..utils.jwt_handler import get_current_user
from ..utils.rate_limit import RateLimiter
from ..services.evaluation_receipt import issue_receipt
from ..services.reward_engine import reward_engine

router = APIRouter(prefix="/api/evaluate", tags=["evaluation"])
speech_rate_limit = RateLimiter(times=30, seconds=60)
ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg",
    "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/ogg", "audio/3gpp",
    "application/octet-stream",
}
tamil_story_evaluator = AcousticStoryEvaluator()
def validate_lesson_target(lesson_id: int, target_phoneme: str) -> str:
    """Return the canonical target only when it belongs to the requested lesson."""
    target = str(target_phoneme).strip().lower()
    if LESSON_PHONEMES.get(lesson_id) != target:
        raise ValueError("Lesson and target phoneme do not match")
    return target


@router.post("/speech", dependencies=[Depends(speech_rate_limit)])
async def evaluate_speech(
    audio: UploadFile = File(...),
    target_phoneme: str = Form(..., min_length=1, max_length=64),
    lesson_id: int = Form(..., ge=1),
    browser_transcript: str = Form("", max_length=64),
    current_user: dict = Depends(get_current_user),
):
    """Evaluate a bounded audio recording without logging child/audio PII."""
    try:
        target_phoneme = validate_lesson_target(lesson_id, target_phoneme)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if audio.content_type and audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported audio type")
    try:
        audio_bytes = await audio.read(settings.MAX_UPLOAD_BYTES + 1)
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")
        if len(audio_bytes) > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Audio file too large")
        if target_phoneme in {'a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ee', 'o', 'oo'}:
            result = await run_in_threadpool(analyze_vowel, audio_bytes, target_phoneme)
        elif target_phoneme in {'ai', 'au'}:
            result = await run_in_threadpool(analyze_diphthong, audio_bytes, target_phoneme)
        else:
            result = await run_in_threadpool(
                speech_evaluator.evaluate_pronunciation,
                audio_bytes,
                target_phoneme,
                browser_transcript,
            )
        result.update({
            "user_id": str(current_user["_id"]),
            "lesson_id": lesson_id,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "target_phoneme": target_phoneme,
        })
        if result.get('scorable'):
            result['stars_earned'] = reward_engine.calculate_evaluation_stars(result)
            result['evaluation_receipt'] = issue_receipt(str(current_user['_id']), dict(result))
        return result
    except HTTPException:
        raise
    except Exception:
        return {
            "error": "evaluation_failed",
            "accuracy": 0,
            "phoneme_match": False,
            "mfcc_score": 0,
            "transcription": "",
            "feedback": "Could not process audio. Please try again with a clear recording.",
            "validation_status": "processing_error",
            "scorable": False,
        }


@router.post("/tamil-story", dependencies=[Depends(speech_rate_limit)])
async def evaluate_tamil_story(
    audio: UploadFile = File(...),
    target_id: Literal["a", "ii", "amma", "kavi_vaa", "kavi_bridge"] = Form(...),
    _current_user: dict = Depends(get_current_user),
):
    """Evaluate one of the five fixed Tamil story targets without persistence."""
    if audio.content_type and audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported audio type",
        )
    audio_bytes = await audio.read(settings.MAX_UPLOAD_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(audio_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large")
    result = await run_in_threadpool(
        tamil_story_evaluator.evaluate, audio_bytes, target_id
    )
    return {**result, "target_id": target_id}


@router.websocket("/ws/face/{session_id}")
async def face_analysis_websocket(websocket: WebSocket, session_id: str):
    """Analyze a live frame stream for the browser practice session."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            result = face_analyzer.analyze_frame(data)
            await websocket.send_json({
                "face_detected": result.face_detected,
                "mouth_open_ratio": result.mouth_open_ratio,
                "mouth_is_open": result.mouth_is_open,
                "stress_level": result.stress_level,
                "emotion": result.emotion,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()
