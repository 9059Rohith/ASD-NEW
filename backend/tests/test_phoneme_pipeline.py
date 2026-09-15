import io
import wave

import numpy as np
import pytest

from app.services.phoneme_pipeline import TARGET_PHONES, align_phones, decode_audio, PhonemeEvaluator
from app.curriculum import LESSON_PHONEMES


def wav(duration=1, amplitude=.2, rate=16000):
    pcm = (amplitude * np.sin(np.arange(int(duration * rate)) * 2 * np.pi * 220 / rate) * 32767).astype('<i2')
    out = io.BytesIO()
    with wave.open(out, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(pcm.tobytes())
    return out.getvalue()


def test_all_authored_targets_have_explicit_ipa():
    assert set(LESSON_PHONEMES.values()) <= set(TARGET_PHONES)


def test_alignment_exposes_substitution_deletion_insertion_and_bounded_score():
    result = align_phones(['a', 'm', 'aː'], ['a', 'p', 'aː'])
    assert result['accuracy'] == pytest.approx(66.67)
    assert result['phoneme_errors'] == [{'expected': 'm', 'actual': 'p', 'operation': 'substitution'}]
    assert align_phones(['a', 'm'], ['a'])['phoneme_errors'][0]['operation'] == 'deletion'
    assert align_phones(['a'], ['a', 'm'])['phoneme_errors'][0]['operation'] == 'insertion'
    assert align_phones(['a'], ['x'] * 10)['accuracy'] == 0
    assert align_phones(['aː'], ['a'])['accuracy'] == 0


def test_decoder_resamples_and_rejects_bad_or_oversized_duration_audio():
    audio, quality = decode_audio(wav(rate=48000))
    assert len(audio) == 16000
    assert quality['duration_seconds'] == 1
    with pytest.raises(ValueError):
        decode_audio(b'not an audio file')
    with pytest.raises(ValueError, match='20 seconds'):
        decode_audio(wav(duration=21))


def test_silence_cannot_be_overridden_by_browser_transcript():
    def unexpected(_audio):
        pytest.fail('Silence must not reach model inference')
    result = PhonemeEvaluator(recognizer=unexpected).evaluate_pronunciation(wav(amplitude=0), 'a', 'அ')
    assert result['validation_status'] == 'no_speech'
    assert result['accuracy'] == 0


def test_audio_phones_determine_score_not_browser_transcript():
    evaluator = PhonemeEvaluator(recognizer=lambda audio: {'phones': ['u'], 'confidence': .8})
    result = evaluator.evaluate_pronunciation(wav(), 'a', 'அ')
    assert result['actual_phonemes'] == ['u']
    assert result['accuracy'] == 0
    assert result['phoneme_match'] is False
    assert result['validation_source'] == 'acoustic_phoneme_model'
    assert result['phoneme_errors'][0]['operation'] == 'substitution'


def test_sentence_tolerance_accepts_one_model_phone_variation_but_not_two_or_a_partial_word():
    expected = TARGET_PHONES['naai_oodugiradhu']
    one_variation = [*expected]
    one_variation[4] = 't'
    accepted = PhonemeEvaluator(recognizer=lambda _audio: {'phones': one_variation, 'confidence': .8}).evaluate_pronunciation(wav(), 'naai_oodugiradhu')
    assert accepted['phoneme_match'] is True
    assert accepted['validation_status'] == 'validated_with_variation'
    two_variations = [*one_variation]
    two_variations[6] = 'p'
    rejected = PhonemeEvaluator(recognizer=lambda _audio: {'phones': two_variations, 'confidence': .8}).evaluate_pronunciation(wav(), 'naai_oodugiradhu')
    assert rejected['phoneme_match'] is False
    partial_word = PhonemeEvaluator(recognizer=lambda _audio: {'phones': ['n', 'aː'], 'confidence': .8}).evaluate_pronunciation(wav(), 'naai')
    assert partial_word['phoneme_match'] is False


def test_unavailable_model_returns_no_invented_score():
    def unavailable(_audio):
        raise RuntimeError('missing model')
    result = PhonemeEvaluator(recognizer=unavailable).evaluate_pronunciation(wav(), 'a', 'அ')
    assert result['validation_status'] == 'recognizer_unavailable'
    assert result['accuracy'] == 0
    assert result['gop_score'] is None
    assert result['scorable'] is False
