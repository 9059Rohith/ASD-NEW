"""Bounded Tamil story pronunciation evaluation.

This module is a playful practice aid, not a clinical assessment.  Isolated
vowels are scored from local acoustic evidence; longer targets use a lazily
loaded Tamil Whisper model.  Missing capabilities are reported explicitly.
"""

from __future__ import annotations

import io
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any, Callable

import numpy as np

from .indicconformer import indicconformer_service


STORY_TARGETS = (
    {"id": "a", "text": "அ", "kind": "vowel"},
    {"id": "ii", "text": "ஈ", "kind": "vowel"},
    {"id": "amma", "text": "அம்மா", "kind": "asr"},
    {"id": "kavi_vaa", "text": "கவி வா", "kind": "asr"},
    {
        "id": "kavi_bridge",
        "text": "கவி பாலத்தைக் கடக்கலாம்",
        "kind": "asr",
    },
)

_TARGET_BY_ID = {target["id"]: target for target in STORY_TARGETS}
_NON_WORD = re.compile(r"[^\w\u0B80-\u0BFF]+", flags=re.UNICODE)
_SPACE = re.compile(r"\s+")


def normalize_tamil(text: str) -> str:
    """Normalize Tamil ASR output without transliterating or changing words."""
    normalized = unicodedata.normalize("NFC", text or "").strip().lower()
    normalized = _NON_WORD.sub(" ", normalized)
    return _SPACE.sub(" ", normalized).strip()


def _require_target(target_id: str) -> dict[str, str]:
    try:
        return _TARGET_BY_ID[target_id]
    except KeyError as exc:
        raise ValueError(f"Unknown Tamil story target: {target_id}") from exc


def _feedback_for(accuracy: float) -> str:
    if accuracy >= 88:
        return "wonderful"
    if accuracy >= 62:
        return "almost"
    return "try_together"


def score_tamil_transcript(target_id: str, transcript: str) -> dict[str, Any]:
    """Score a Tamil transcript using character order and important-word recall."""
    target = _require_target(target_id)
    expected = normalize_tamil(target["text"])
    actual = normalize_tamil(transcript)

    if not actual:
        accuracy = 0.0
    else:
        character_score = SequenceMatcher(None, expected, actual).ratio()
        expected_tokens = expected.split()
        actual_tokens = set(actual.split())
        token_score = sum(token in actual_tokens for token in expected_tokens) / len(
            expected_tokens
        )
        accuracy = round((character_score * 0.65 + token_score * 0.35) * 100, 2)

    accuracy = min(100.0, max(0.0, accuracy))
    return {
        "accuracy": accuracy,
        "matched": accuracy >= 82.0,
        "feedback_key": _feedback_for(accuracy),
    }


class TamilStoryEvaluator:
    """Route the five fixed story targets to acoustic or Tamil-ASR evaluation."""

    def __init__(
        self,
        acoustic_analyzer: Callable[[bytes, str], float] | None = None,
        indic_transcriber: Callable[[bytes], str] | None = None,
        transcriber_factory: Callable[[], Callable[[bytes], str]] | None = None,
    ) -> None:
        self._acoustic_analyzer = acoustic_analyzer or self._score_vowel
        self._indic_transcriber = indic_transcriber or indicconformer_service.transcribe
        self._transcriber_factory = transcriber_factory or self._create_transcriber
        self._transcriber: Callable[[bytes], str] | None = None
        self._model_attempted = False

    def evaluate(self, audio_bytes: bytes, target_id: str) -> dict[str, Any]:
        target = _require_target(target_id)
        if target["kind"] == "vowel":
            try:
                accuracy = float(self._acoustic_analyzer(audio_bytes, target_id))
            except Exception:
                return self._unavailable("acoustic_vowel", "audio_unavailable")
            accuracy = round(min(100.0, max(0.0, accuracy)), 2)
            return {
                "accuracy": accuracy,
                "matched": accuracy >= 70.0,
                "method": "acoustic_vowel",
                "transcript": "",
                "feedback_key": _feedback_for(accuracy),
                "capability": "available",
            }

        try:
            indic_transcript = normalize_tamil(self._indic_transcriber(audio_bytes))
        except Exception:
            indic_transcript = ""
        if indic_transcript:
            scored = score_tamil_transcript(target_id, indic_transcript)
            return {
                **scored,
                "method": "indicconformer_tamil_asr",
                "transcript": indic_transcript,
                "capability": "available",
            }

        transcriber = self._ensure_transcriber()
        if transcriber is None:
            return self._unavailable("tamil_asr", "model_unavailable")
        try:
            transcript = normalize_tamil(transcriber(audio_bytes))
        except Exception:
            return self._unavailable("tamil_asr", "model_unavailable")
        scored = score_tamil_transcript(target_id, transcript)
        return {
            **scored,
            "method": "tamil_asr",
            "transcript": transcript,
            "capability": "available",
        }

    def _ensure_transcriber(self) -> Callable[[bytes], str] | None:
        if not self._model_attempted:
            self._model_attempted = True
            try:
                self._transcriber = self._transcriber_factory()
            except Exception:
                self._transcriber = None
        return self._transcriber

    @staticmethod
    def _unavailable(method: str, capability: str) -> dict[str, Any]:
        return {
            "accuracy": None,
            "matched": None,
            "method": method,
            "transcript": "",
            "feedback_key": capability,
            "capability": capability,
        }

    @staticmethod
    def _load_audio(audio_bytes: bytes) -> np.ndarray:
        import librosa

        audio, _ = librosa.load(io.BytesIO(audio_bytes), sr=16000, mono=True)
        audio, _ = librosa.effects.trim(audio.astype(np.float32), top_db=28)
        if audio.size < 800:
            raise ValueError("No usable speech detected")
        peak = float(np.max(np.abs(audio)))
        if peak < 1e-5:
            raise ValueError("No usable speech detected")
        return audio / peak

    @classmethod
    def _score_vowel(cls, audio_bytes: bytes, target_id: str) -> float:
        """Score voice presence, sustain, steadiness, and target spectral shape."""
        import librosa

        audio = cls._load_audio(audio_bytes)
        duration = len(audio) / 16000.0
        rms = librosa.feature.rms(y=audio, frame_length=512, hop_length=160)[0]
        voiced_rms = rms[rms > 0.025]
        if voiced_rms.size == 0:
            return 0.0

        sustain_target = 0.30 if target_id == "a" else 0.48
        sustain = min(1.0, duration / sustain_target)
        presence = min(1.0, float(np.mean(voiced_rms)) / 0.12)
        steadiness = 1.0 - min(1.0, float(np.std(voiced_rms)) / 0.18)
        centroid = float(
            np.median(
                librosa.feature.spectral_centroid(y=audio, sr=16000, hop_length=160)[0]
            )
        )
        # /ஈ/ typically carries more high-frequency formant energy than open /அ/.
        spectral = (
            max(0.0, 1.0 - abs(centroid - 1250.0) / 1800.0)
            if target_id == "a"
            else max(0.0, 1.0 - abs(centroid - 2200.0) / 2200.0)
        )
        return (presence * 0.25 + sustain * 0.35 + steadiness * 0.20 + spectral * 0.20) * 100

    @classmethod
    def _create_transcriber(cls) -> Callable[[bytes], str]:
        from transformers import pipeline

        asr = pipeline(
            "automatic-speech-recognition",
            model="vasista22/whisper-tamil-small",
            device=-1,
        )

        def transcribe(audio_bytes: bytes) -> str:
            audio = cls._load_audio(audio_bytes)
            payload = {"raw": audio, "sampling_rate": 16000}
            try:
                result = asr(
                    payload,
                    generate_kwargs={"language": "tamil", "task": "transcribe"},
                )
            except (TypeError, ValueError):
                result = asr(payload)
            return str(result.get("text", ""))

        return transcribe
