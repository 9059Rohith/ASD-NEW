"""Tests for allow-listed Indian Tamil neural speech synthesis."""

import asyncio

import pytest

from app.services.story_voice import (
    STORY_VOICE_LINES,
    StoryVoiceService,
    StoryVoiceUnavailable,
    build_azure_ssml,
)


def test_voice_allowlist_contains_every_curriculum_target():
    assert [STORY_VOICE_LINES[f"lesson_{number}"] for number in range(1, 17)] == [
        "அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ",
        "அம்மா", "அப்பா", "மரம்", "பழம்",
    ]


def test_azure_ssml_uses_indian_tamil_voice_and_escapes_text():
    ssml = build_azure_ssml("அம்மா & அப்பா", "ta-IN-PallaviNeural")
    assert 'xml:lang="ta-IN"' in ssml
    assert 'name="ta-IN-PallaviNeural"' in ssml
    assert "அம்மா &amp; அப்பா" in ssml
    assert 'rate="-12%"' in ssml
    assert 'pitch="+0%"' in ssml


def test_service_passes_azure_configuration_and_caches_audio():
    calls = []

    async def transport(text, api_key, region, voice):
        calls.append((text, api_key, region, voice))
        return b"tamil-mp3"

    service = StoryVoiceService(
        api_key="secret", region="centralindia", voice="ta-IN-PallaviNeural", transport=transport
    )
    first = asyncio.run(service.get_audio("lesson_15"))
    second = asyncio.run(service.get_audio("lesson_15"))

    assert first == second == b"tamil-mp3"
    assert calls == [("மரம்", "secret", "centralindia", "ta-IN-PallaviNeural")]


def test_service_rejects_unknown_or_unconfigured_voice_requests():
    service = StoryVoiceService(api_key="", region="", voice="ta-IN-PallaviNeural")
    with pytest.raises(KeyError):
        asyncio.run(service.get_audio("free-form-child-text"))
    with pytest.raises(StoryVoiceUnavailable, match="not configured"):
        asyncio.run(service.get_audio("lesson_1"))
