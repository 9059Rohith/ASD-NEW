"""Regenerate every learner-facing Tamil word clip with one native Tamil voice.

Run from ``backend`` with ``.runtime\\Scripts\\python.exe
scripts\\regenerate_tamil_word_references.py``. The script stages and validates
all ten clips before replacing any checked-in WAV file.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile

import edge_tts
import numpy as np
from scipy.signal import resample_poly
import soundfile as sf

from generate_tamil_references import OUTPUT, validate_wav


VOICE = 'ta-IN-ValluvarNeural'
PROVIDER = 'Microsoft Edge online speech service'
PROVIDER_URL = 'https://github.com/rany2/edge-tts'
TARGET_RATE = 16000


async def synthesize_word(text: str, destination: Path) -> None:
    mp3_path = destination.with_suffix('.mp3')
    await edge_tts.Communicate(text, VOICE).save(str(mp3_path))
    samples, source_rate = sf.read(mp3_path, dtype='float32', always_2d=False)
    if samples.ndim != 1 or not samples.size or not np.isfinite(samples).all():
        raise ValueError(f'Invalid synthesized audio for {destination.name}')
    if source_rate != TARGET_RATE:
        divisor = np.gcd(source_rate, TARGET_RATE)
        samples = resample_poly(samples, TARGET_RATE // divisor, source_rate // divisor)
    peak = float(np.max(np.abs(samples)))
    if peak > .95:
        samples = samples * (.95 / peak)
    sf.write(destination, samples, TARGET_RATE, subtype='PCM_16')


async def regenerate() -> None:
    manifest_path = OUTPUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    words = [row for row in manifest['items'] if row['kind'] == 'word']
    if len(words) != 10:
        raise ValueError(f'Expected 10 word references, found {len(words)}')
    for row in words:
        row['filename'] = f"{row['id']}-valluvar.wav"
        row['audio_url'] = f"/assets/tamil-reference/{row['filename']}"

    with tempfile.TemporaryDirectory(prefix='tamil-word-audio-') as temporary:
        staging = Path(temporary)
        staged = {}
        for row in words:
            destination = staging / row['filename']
            await synthesize_word(row['text'], destination)
            staged[row['id']] = (destination, validate_wav(destination))
            print(f"Synthesized {row['id']} with {VOICE}", flush=True)

        for row in words:
            staged_path, measurements = staged[row['id']]
            output_path = OUTPUT / row['filename']
            output_path.write_bytes(staged_path.read_bytes())
            for obsolete in ('input_token_ids', 'seed', 'peak_gain'):
                row.pop(obsolete, None)
            row.update({
                'audio_kind': 'synthetic_tamil',
                'license': 'Microsoft online speech service terms',
                'synthesis_text': row['text'],
                'synthesis_provider': PROVIDER,
                'synthesis_provider_url': PROVIDER_URL,
                'synthesis_voice': VOICE,
                'unknown_tamil_character_ratio': 0.0,
                'audio': measurements,
            })

    manifest['word_voice'] = {
        'provider': PROVIDER,
        'provider_url': PROVIDER_URL,
        'voice': VOICE,
        'locale': 'ta-IN',
        'regenerated_at': datetime.now(timezone.utc).isoformat(),
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )
    print(f'Updated {len(words)} Tamil word references.', flush=True)


if __name__ == '__main__':
    asyncio.run(regenerate())
