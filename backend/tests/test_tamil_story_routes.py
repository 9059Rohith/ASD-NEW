from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.routers import evaluation
from app.routers import story_voice
from app.services.story_voice import (
    STORY_VOICE_LINES,
    StoryVoiceService,
    StoryVoiceUnavailable,
)
from app.utils.jwt_handler import get_current_user


class _FakeEvaluator:
    def __init__(self):
        self.calls = []

    def evaluate(self, audio_bytes, target_id):
        self.calls.append((audio_bytes, target_id))
        return {
            "accuracy": 94.0,
            "matched": True,
            "method": "tamil_asr",
            "transcript": "அம்மா",
            "feedback_key": "wonderful",
            "capability": "available",
        }


def _evaluation_client(monkeypatch, authenticated=True):
    fake = _FakeEvaluator()
    monkeypatch.setattr(evaluation, "tamil_story_evaluator", fake)
    app = FastAPI()
    app.include_router(evaluation.router)
    if authenticated:
        app.dependency_overrides[get_current_user] = lambda: {"_id": "parent-1"}
    return TestClient(app), fake


def test_tamil_story_evaluation_requires_authentication(monkeypatch):
    client, _ = _evaluation_client(monkeypatch, authenticated=False)

    response = client.post(
        "/api/evaluate/tamil-story",
        data={"target_id": "amma"},
        files={"audio": ("speech.webm", b"voice", "audio/webm")},
    )

    assert response.status_code == 401


@pytest.mark.parametrize("target_id", ["a", "ii", "amma", "kavi_vaa", "kavi_bridge"])
def test_tamil_story_evaluation_accepts_only_the_five_targets(monkeypatch, target_id):
    client, fake = _evaluation_client(monkeypatch)

    response = client.post(
        "/api/evaluate/tamil-story",
        data={"target_id": target_id},
        files={"audio": ("speech.webm", b"voice", "audio/webm")},
    )

    assert response.status_code == 200
    assert response.json()["target_id"] == target_id
    assert fake.calls == [(b"voice", target_id)]


def test_tamil_story_evaluation_rejects_unknown_target(monkeypatch):
    client, fake = _evaluation_client(monkeypatch)

    response = client.post(
        "/api/evaluate/tamil-story",
        data={"target_id": "anything-the-child-said"},
        files={"audio": ("speech.webm", b"voice", "audio/webm")},
    )

    assert response.status_code == 422
    assert fake.calls == []


@pytest.mark.parametrize(
    ("filename", "content", "content_type", "expected_status"),
    [
        ("speech.txt", b"voice", "text/plain", 415),
        ("speech.webm", b"", "audio/webm", 400),
    ],
)
def test_tamil_story_evaluation_rejects_unsafe_audio(
    monkeypatch, filename, content, content_type, expected_status
):
    client, fake = _evaluation_client(monkeypatch)

    response = client.post(
        "/api/evaluate/tamil-story",
        data={"target_id": "a"},
        files={"audio": (filename, content, content_type)},
    )

    assert response.status_code == expected_status
    assert fake.calls == []


def test_tamil_story_evaluation_enforces_upload_limit(monkeypatch):
    monkeypatch.setattr(evaluation.settings, "MAX_UPLOAD_BYTES", 4)
    client, fake = _evaluation_client(monkeypatch)

    response = client.post(
        "/api/evaluate/tamil-story",
        data={"target_id": "a"},
        files={"audio": ("speech.webm", b"12345", "audio/webm")},
    )

    assert response.status_code == 413
    assert fake.calls == []


def test_tamil_story_route_has_the_shared_rate_limiter_dependency():
    route = next(
        route for route in evaluation.router.routes if route.path.endswith("/tamil-story")
    )

    dependencies = [dependency.call for dependency in route.dependant.dependencies]
    assert evaluation.speech_rate_limit in dependencies


@pytest.mark.asyncio
async def test_story_voice_service_uses_fixed_tamil_line_and_caches_audio():
    calls = []

    async def transport(text, api_key, voice_id):
        calls.append((text, api_key, voice_id))
        return b"mp3-audio"

    service = StoryVoiceService(
        api_key="server-secret",
        voice_id="cute-kavi",
        transport=transport,
    )

    first = await service.get_audio("page_1")
    second = await service.get_audio("page_1")

    assert first == second == b"mp3-audio"
    assert calls == [(STORY_VOICE_LINES["page_1"], "server-secret", "cute-kavi")]


@pytest.mark.asyncio
async def test_story_voice_service_rejects_arbitrary_text_and_disabled_provider():
    service = StoryVoiceService(api_key="", voice_id="")

    with pytest.raises(KeyError):
        await service.get_audio("அந்தக் குழந்தை சொன்ன உரை")
    with pytest.raises(StoryVoiceUnavailable):
        await service.get_audio("page_1")


def test_story_voice_route_is_authenticated_allow_listed_and_returns_mp3(monkeypatch):
    class FakeVoiceService:
        async def get_audio(self, line_id):
            assert line_id == "page_1"
            return b"fixed-line-audio"

    monkeypatch.setattr(story_voice, "story_voice_service", FakeVoiceService())
    app = FastAPI()
    app.include_router(story_voice.router)
    app.dependency_overrides[get_current_user] = lambda: {"_id": "parent-1"}

    with TestClient(app) as client:
        ok = client.get("/api/story-voice/page_1")
        rejected = client.get("/api/story-voice/arbitrary-child-text")

    assert ok.status_code == 200
    assert ok.content == b"fixed-line-audio"
    assert ok.headers["content-type"] == "audio/mpeg"
    assert ok.headers["cache-control"] == "private, max-age=3600"
    assert rejected.status_code == 404


def test_story_voice_route_reports_disabled_provider_without_leaking_config(monkeypatch):
    class DisabledVoiceService:
        async def get_audio(self, _line_id):
            raise StoryVoiceUnavailable("secret provider configuration detail")

    monkeypatch.setattr(story_voice, "story_voice_service", DisabledVoiceService())
    app = FastAPI()
    app.include_router(story_voice.router)
    app.dependency_overrides[get_current_user] = lambda: {"_id": "parent-1"}

    response = TestClient(app).get("/api/story-voice/page_1")

    assert response.status_code == 503
    assert response.json() == {"detail": "story_voice_unavailable"}
