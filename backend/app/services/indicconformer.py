"""Lazy local inference adapter for AI4Bharat Tamil IndicConformer."""

from __future__ import annotations

import io
import importlib.util
import tempfile
import threading
import unicodedata
import wave
from pathlib import Path
from typing import Any, Callable

import numpy as np

from ..config import settings


class IndicConformerUnavailable(RuntimeError):
    """Raised when local IndicConformer inference cannot be used."""


def normalize_transcription(result: Any) -> str:
    """Extract normalized text from common NeMo transcription result shapes."""
    if isinstance(result, (list, tuple)):
        result = result[0] if result else ""
    if hasattr(result, "text"):
        result = result.text
    if isinstance(result, (list, tuple)):
        result = result[0] if result else ""
    return unicodedata.normalize("NFC", str(result or "")).strip()


def _default_model_loader(model_path: Path, device: str):
    try:
        import torch
        import nemo.collections.asr as nemo_asr
    except ImportError as exc:
        raise IndicConformerUnavailable(
            "AI4Bharat NeMo runtime is not installed"
        ) from exc

    selected_device = device
    if device == "auto":
        selected_device = "cuda" if torch.cuda.is_available() else "cpu"
    if selected_device not in {"cpu", "cuda"}:
        raise IndicConformerUnavailable("IndicConformer device must be auto, cpu, or cuda")
    if selected_device == "cuda" and not torch.cuda.is_available():
        raise IndicConformerUnavailable("CUDA was requested but is unavailable")

    model = nemo_asr.models.ASRModel.restore_from(
        restore_path=str(model_path), map_location=selected_device
    )
    model.eval()
    model.to(selected_device)
    return model


class IndicConformerService:
    """Restore one local checkpoint lazily and transcribe short recordings."""

    def __init__(
        self,
        model_path: str | Path,
        enabled: bool = True,
        device: str = "auto",
        model_loader: Callable[[Path, str], Any] | None = None,
    ) -> None:
        self.model_path = Path(model_path).expanduser().resolve()
        self.enabled = bool(enabled)
        self.device = str(device).strip().lower()
        self._uses_default_loader = model_loader is None
        self._model_loader = model_loader or _default_model_loader
        self._model = None
        self._load_attempted = False
        self._load_error: IndicConformerUnavailable | None = None
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()

    def capability_status(self) -> dict[str, str]:
        """Describe Tamil STT availability without loading a large checkpoint."""
        if not self.enabled:
            return {"status": "disabled"}
        if not self.model_path.is_file():
            return {"status": "unavailable", "reason": "checkpoint_missing"}
        if self._model is not None:
            return {"status": "ready"}
        if self._load_error is not None:
            return {"status": "unavailable", "reason": "model_load_failed"}
        if self._uses_default_loader and importlib.util.find_spec("nemo") is None:
            return {"status": "unavailable", "reason": "runtime_missing"}
        return {"status": "not_loaded"}

    def _ensure_model(self):
        if not self.enabled:
            raise IndicConformerUnavailable("IndicConformer is disabled")
        if not self.model_path.is_file():
            raise IndicConformerUnavailable("IndicConformer checkpoint was not found")
        if self._model is not None:
            return self._model
        if self._load_attempted and self._load_error is not None:
            raise self._load_error

        with self._load_lock:
            if self._model is not None:
                return self._model
            if self._load_attempted and self._load_error is not None:
                raise self._load_error
            self._load_attempted = True
            try:
                self._model = self._model_loader(self.model_path, self.device)
            except IndicConformerUnavailable as exc:
                self._load_error = exc
                raise
            except Exception as exc:
                self._load_error = IndicConformerUnavailable(
                    "IndicConformer model could not be loaded"
                )
                raise self._load_error from exc
            return self._model

    def warm_up(self) -> bool:
        """Load the optional model in a background worker without failing startup."""
        try:
            self._ensure_model()
            return True
        except IndicConformerUnavailable:
            return False

    @staticmethod
    def _temporary_wav(audio_bytes: bytes) -> str:
        import librosa

        audio, _ = librosa.load(io.BytesIO(audio_bytes), sr=16000, mono=True)
        audio = np.asarray(audio, dtype=np.float32)
        if audio.size < 800 or not np.all(np.isfinite(audio)):
            raise IndicConformerUnavailable("Recording contains no usable speech")
        peak = float(np.max(np.abs(audio)))
        if peak < 1e-5:
            raise IndicConformerUnavailable("Recording contains no usable speech")
        pcm = (np.clip(audio / peak, -1.0, 1.0) * 32767).astype("<i2")
        handle = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        path = handle.name
        handle.close()
        with wave.open(path, "wb") as stream:
            stream.setnchannels(1)
            stream.setsampwidth(2)
            stream.setframerate(16000)
            stream.writeframes(pcm.tobytes())
        return path

    def transcribe(self, audio_bytes: bytes) -> str:
        model = self._ensure_model()
        path = ""
        try:
            path = self._temporary_wav(audio_bytes)
            with self._inference_lock:
                result = model.transcribe([path], language_id="ta")
            return normalize_transcription(result)
        except IndicConformerUnavailable:
            raise
        except Exception as exc:
            raise IndicConformerUnavailable("IndicConformer inference failed") from exc
        finally:
            if path:
                Path(path).unlink(missing_ok=True)


indicconformer_service = IndicConformerService(
    model_path=settings.INDICCONFORMER_MODEL_PATH,
    enabled=settings.INDICCONFORMER_ENABLED,
    device=settings.INDICCONFORMER_DEVICE,
)
