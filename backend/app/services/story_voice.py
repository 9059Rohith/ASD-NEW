"""Allow-listed Indian Tamil neural voice synthesis for application sessions."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from html import escape

import httpx

from ..config import settings
from ..curriculum import TAMIL_LESSONS


STORY_VOICE_LINES = {
    **{lesson["voice_key"]: lesson["symbol"] for lesson in TAMIL_LESSONS},
    "page_1": "கவி ஆற்றங்கரையில் நிற்கிறான். பாதையைத் திறக்க அ என்று சொல்லலாமா?",
    "page_2": "மின்மினிப் பூச்சிகள் வழி காட்ட வேண்டும். ஈ என்று நீளமாகச் சொல்லுங்கள்.",
    "page_3": "கவி தன் அம்மாவை அழைக்க வேண்டும். அம்மா என்று சொல்லுங்கள்.",
    "page_4": "பாலம் அருகே வந்துவிட்டது. கவி வா என்று அழையுங்கள்.",
    "page_5": "கவி பாலத்தைக் கடக்கத் தயாராக இருக்கிறான். கவி பாலத்தைக் கடக்கலாம் என்று சொல்லுங்கள்.",
    "listen": "நன்றாகக் கேளுங்கள்.",
    "your_turn": "இப்போது நீங்கள் சொல்லுங்கள்.",
    "wonderful": "அருமை! மிக அழகாகச் சொன்னீர்கள்!",
    "almost": "நன்றாக முயன்றீர்கள்! இன்னொரு முறை மெதுவாகச் சொல்லலாமா?",
    "try_together": "நாம் சேர்ந்து மெதுவாகச் சொல்லலாம்.",
    "model_unavailable": "நான் கேட்கிறேன். படத்தைப் பார்த்து நாமே சேர்ந்து சொல்லலாம்.",
    "complete": "அருமை! பயிற்சியை முடித்துவிட்டீர்கள்!",
}

VoiceTransport = Callable[[str, str, str, str], Awaitable[bytes]]


class StoryVoiceUnavailable(RuntimeError):
    """Raised when the configured Tamil voice provider cannot respond."""


def build_azure_ssml(text: str, voice: str = "ta-IN-PallaviNeural") -> str:
    """Build child-friendly SSML locked to the Indian Tamil locale."""
    safe_text = escape(str(text), quote=False)
    safe_voice = escape(str(voice), quote=True)
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xml:lang="ta-IN">'
        f'<voice name="{safe_voice}"><prosody rate="-12%" pitch="+0%">'
        f"{safe_text}</prosody></voice></speak>"
    )


class StoryVoiceService:
    def __init__(
        self,
        api_key: str | None = None,
        region: str | None = None,
        voice: str | None = None,
        voice_id: str | None = None,
        transport: VoiceTransport | None = None,
    ) -> None:
        self._legacy_transport = voice_id is not None
        self._api_key = settings.AZURE_SPEECH_KEY if api_key is None else api_key
        self._region = ("legacy" if self._legacy_transport else settings.AZURE_SPEECH_REGION) if region is None else region
        self._voice = voice_id if voice_id is not None else (settings.TAMIL_SPEECH_VOICE if voice is None else voice)
        self._transport = transport or self._azure_transport
        self._cache: dict[str, bytes] = {}

    async def get_audio(self, line_id: str) -> bytes:
        if line_id not in STORY_VOICE_LINES:
            raise KeyError(line_id)
        if line_id in self._cache:
            return self._cache[line_id]
        if not self._api_key or not self._region or not self._voice:
            raise StoryVoiceUnavailable("Tamil voice provider is not configured")
        try:
            if self._legacy_transport:
                audio = await self._transport(STORY_VOICE_LINES[line_id], self._api_key, self._voice)
            else:
                audio = await self._transport(
                    STORY_VOICE_LINES[line_id], self._api_key, self._region, self._voice
                )
        except StoryVoiceUnavailable:
            raise
        except Exception as exc:
            raise StoryVoiceUnavailable("Tamil voice provider failed") from exc
        if not audio:
            raise StoryVoiceUnavailable("Tamil voice provider returned no audio")
        self._cache[line_id] = audio
        return audio

    @staticmethod
    async def _azure_transport(text: str, api_key: str, region: str, voice: str) -> bytes:
        url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
        headers = {
            "Ocp-Apim-Subscription-Key": api_key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
            "User-Agent": "SpeakEasy-Tamil-Training",
            "Accept": "audio/mpeg",
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    url, headers=headers, content=build_azure_ssml(text, voice).encode("utf-8")
                )
                response.raise_for_status()
                return response.content
        except httpx.HTTPError as exc:
            raise StoryVoiceUnavailable("Tamil voice provider failed") from exc


story_voice_service = StoryVoiceService()
