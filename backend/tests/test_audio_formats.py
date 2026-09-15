"""Exercise actual compressed recording formats used by Android and browsers."""
import io

import av
import numpy as np
import pytest

from app.services.phoneme_pipeline import decode_audio


@pytest.mark.parametrize('container,codec,rate', [('mp4', 'aac', 44100), ('webm', 'libopus', 48000)])
def test_compressed_recording_decodes_to_bounded_mono_16khz(container, codec, rate):
    # This is a codec/transport test, not evidence of speech recognition accuracy.
    samples = (0.2 * np.sin(2 * np.pi * 220 * np.arange(rate) / rate)).astype(np.float32)
    encoded = io.BytesIO()
    output = av.open(encoded, mode='w', format=container)
    stream = output.add_stream(codec, rate=rate)
    stream.layout = 'mono'
    frame = av.AudioFrame.from_ndarray(samples[None, :], format='fltp', layout='mono')
    frame.sample_rate = rate
    for packet in stream.encode(frame):
        output.mux(packet)
    for packet in stream.encode(None):
        output.mux(packet)
    output.close()
    audio, quality = decode_audio(encoded.getvalue())
    assert audio.ndim == 1
    assert 15000 <= len(audio) <= 18000
    assert quality['has_speech'] is True
    assert quality['duration_seconds'] < 1.2
