import io
import wave

import numpy as np
import pytest

from app.config import Settings
from app.services.indicconformer import (
    IndicConformerService,
    IndicConformerUnavailable,
    normalize_transcription,
)
from scripts.smoke_indicconformer import run_smoke


def wav_bytes(duration=0.25):
    sample_rate = 16000
    timeline = np.arange(int(sample_rate * duration), dtype=np.float32) / sample_rate
    pcm = (0.2 * np.sin(2 * np.pi * 220 * timeline) * 32767).astype("<i2")
    output = io.BytesIO()
    with wave.open(output, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(sample_rate)
        stream.writeframes(pcm.tobytes())
    return output.getvalue()


class FakeHypothesis:
    text = "  அம்மா  "


class FakeModel:
    def __init__(self, result):
        self.result = result
        self.paths = []
        self.language_ids = []

    def transcribe(self, paths, language_id=None):
        self.paths.extend(paths)
        self.language_ids.append(language_id)
        return self.result


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ([" அம்மா "], "அம்மா"),
        ([FakeHypothesis()], "அம்மா"),
        (" கவி வா ", "கவி வா"),
        ([], ""),
    ],
)
def test_normalize_transcription_handles_nemo_result_shapes(raw, expected):
    assert normalize_transcription(raw) == expected


def test_service_loads_once_transcribes_and_removes_temporary_audio(tmp_path):
    checkpoint = tmp_path / "tamil.nemo"
    checkpoint.write_bytes(b"model")
    model = FakeModel([FakeHypothesis()])
    loads = []

    def loader(path, device):
        loads.append((path, device))
        return model

    service = IndicConformerService(checkpoint, device="cpu", model_loader=loader)

    assert service.transcribe(wav_bytes()) == "அம்மா"
    assert service.transcribe(wav_bytes()) == "அம்மா"
    assert loads == [(checkpoint.resolve(), "cpu")]
    assert len(model.paths) == 2
    assert model.language_ids == ["ta", "ta"]
    assert all(not __import__("pathlib").Path(path).exists() for path in model.paths)


def test_service_capability_status_tracks_configuration_and_loaded_model(tmp_path):
    checkpoint = tmp_path / "tamil.nemo"
    missing = IndicConformerService(checkpoint)
    assert missing.capability_status() == {"status": "unavailable", "reason": "checkpoint_missing"}

    checkpoint.write_bytes(b"model")
    disabled = IndicConformerService(checkpoint, enabled=False)
    assert disabled.capability_status() == {"status": "disabled"}

    model = FakeModel(["unused"])
    service = IndicConformerService(checkpoint, model_loader=lambda _path, _device: model)
    assert service.capability_status() == {"status": "not_loaded"}
    assert service.warm_up() is True
    assert service.capability_status() == {"status": "ready"}

    broken = IndicConformerService(checkpoint, model_loader=lambda _path, _device: (_ for _ in ()).throw(RuntimeError("secret")))
    assert broken.warm_up() is False
    assert broken.capability_status() == {"status": "unavailable", "reason": "model_load_failed"}


def test_service_capability_status_exposes_missing_runtime_without_loading_checkpoint(tmp_path, monkeypatch):
    checkpoint = tmp_path / "tamil.nemo"
    checkpoint.write_bytes(b"model")
    monkeypatch.setattr("app.services.indicconformer.importlib.util.find_spec", lambda name: None)
    service = IndicConformerService(checkpoint)

    assert service.capability_status() == {"status": "unavailable", "reason": "runtime_missing"}
    assert service._load_attempted is False


def test_warm_up_loads_model_without_transcribing(tmp_path):
    checkpoint = tmp_path / "tamil.nemo"
    checkpoint.write_bytes(b"model")
    model = FakeModel(["unused"])
    loads = []
    service = IndicConformerService(
        checkpoint,
        model_loader=lambda path, device: loads.append((path, device)) or model,
    )

    service.warm_up()
    service.warm_up()

    assert loads == [(checkpoint.resolve(), "auto")]
    assert model.paths == []


@pytest.mark.parametrize(
    ("enabled", "create_checkpoint", "message"),
    [
        (False, True, "disabled"),
        (True, False, "not found"),
    ],
)
def test_service_reports_disabled_or_missing_checkpoint(
    tmp_path, enabled, create_checkpoint, message
):
    checkpoint = tmp_path / "tamil.nemo"
    if create_checkpoint:
        checkpoint.write_bytes(b"model")
    service = IndicConformerService(checkpoint, enabled=enabled)

    with pytest.raises(IndicConformerUnavailable, match=message):
        service.transcribe(wav_bytes())


def test_service_wraps_loader_and_inference_failures(tmp_path):
    checkpoint = tmp_path / "tamil.nemo"
    checkpoint.write_bytes(b"model")

    def broken_loader(_path, _device):
        raise RuntimeError("private loader detail")

    service = IndicConformerService(checkpoint, model_loader=broken_loader)
    with pytest.raises(IndicConformerUnavailable, match="could not be loaded"):
        service.transcribe(wav_bytes())

    model = FakeModel([])
    service = IndicConformerService(
        checkpoint, model_loader=lambda _path, _device: model
    )
    assert service.transcribe(wav_bytes()) == ""


def test_service_removes_temporary_audio_after_inference_failure(tmp_path):
    checkpoint = tmp_path / "tamil.nemo"
    checkpoint.write_bytes(b"model")

    class BrokenModel:
        path = None

        def transcribe(self, paths, language_id=None):
            self.path = paths[0]
            raise RuntimeError("private inference detail")

    model = BrokenModel()
    service = IndicConformerService(
        checkpoint, model_loader=lambda _path, _device: model
    )

    with pytest.raises(IndicConformerUnavailable, match="inference failed"):
        service.transcribe(wav_bytes())

    assert model.path is not None
    assert not __import__("pathlib").Path(model.path).exists()


def test_settings_accept_indicconformer_environment_values(monkeypatch, tmp_path):
    checkpoint = tmp_path / "configured.nemo"
    monkeypatch.setenv("INDICCONFORMER_ENABLED", "false")
    monkeypatch.setenv("INDICCONFORMER_MODEL_PATH", str(checkpoint))
    monkeypatch.setenv("INDICCONFORMER_DEVICE", "CPU")

    configured = Settings(_env_file=None)

    assert configured.INDICCONFORMER_ENABLED is False
    assert configured.INDICCONFORMER_MODEL_PATH == str(checkpoint)
    assert configured.INDICCONFORMER_DEVICE == "cpu"


def test_smoke_command_reports_success_without_loading_real_model(tmp_path, capsys):
    audio = tmp_path / "sample.wav"
    audio.write_bytes(wav_bytes())
    checkpoint = tmp_path / "tamil.nemo"
    checkpoint.write_bytes(b"model")

    class FakeService:
        def transcribe(self, audio_bytes):
            assert audio_bytes == audio.read_bytes()
            return "அம்மா"

    result = run_smoke(
        audio,
        checkpoint,
        "cpu",
        service_factory=lambda **_kwargs: FakeService(),
    )

    assert result == 0
    assert "அம்மா" in capsys.readouterr().out


def test_smoke_command_rejects_missing_audio(tmp_path, capsys):
    result = run_smoke(
        tmp_path / "missing.wav",
        tmp_path / "tamil.nemo",
        "cpu",
    )

    assert result == 1
    assert "Audio file was not found" in capsys.readouterr().out


def test_smoke_command_rejects_missing_model(tmp_path, capsys):
    audio = tmp_path / "sample.wav"
    audio.write_bytes(wav_bytes())

    result = run_smoke(audio, tmp_path / "missing.nemo", "cpu")

    assert result == 1
    assert "checkpoint was not found" in capsys.readouterr().out
