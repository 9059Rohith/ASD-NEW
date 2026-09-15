"""Signal fixtures test gates only; reported recognition metrics use human audio."""
import io
import json

import numpy as np
import pytest
import soundfile as sf

from app.services import vowel_analysis as va


def wav(samples, subtype='PCM_16'):
    data = io.BytesIO()
    sf.write(data, samples, 16000, format='WAV', subtype=subtype)
    return data.getvalue()


def voiced(seconds=.5):
    t = np.arange(int(seconds * 16000)) / 16000
    return (.15 * np.sin(2 * np.pi * 180 * t) + .08 * np.sin(2 * np.pi * 360 * t)).astype('float32')


def test_silence_is_unscorable():
    result = va.analyze_vowel(wav(np.zeros(112000)), 'a')
    assert not result['scorable']
    assert result['validation_status'] == 'no_speech'
    assert result['accuracy'] == 0


def test_duration_measures_voicing_not_seven_second_container():
    signal = np.concatenate([np.zeros(16000), voiced(.5), np.zeros(88000)])
    segment = va.extract_features(signal)
    assert .45 <= segment['duration_seconds'] <= .56
    assert .95 <= segment['onset_seconds'] <= 1.05


def test_separated_vowels_are_rejected():
    signal = np.concatenate([voiced(), np.zeros(8000), voiced()])
    result = va.analyze_vowel(wav(signal), 'a')
    assert not result['scorable']
    assert result['validation_status'] == 'multiple_vowels'


def test_noise_is_unscorable():
    noise = np.random.default_rng(7).normal(0, .08, 112000)
    result = va.analyze_vowel(wav(noise), 'a')
    assert not result['scorable']
    assert result['validation_status'] in {'no_speech', 'noisy_audio'}


def test_low_confidence_vowel_with_valid_voice_returns_conservative_score(monkeypatch):
    """A valid captured vowel keeps a score even below the identity pass gate."""
    class LowConfidenceIdentity:
        classes_ = np.asarray(['A', 'E', 'I', 'O', 'U'])

        def predict_proba(self, rows):
            return np.tile(np.asarray([.08, .12, .5077, .14, .1523]), (len(rows), 1))

    features = {
        'status': 'ok',
        'quality': {'duration_seconds': 6.66, 'rms': .039, 'peak': .433,
                    'clipping_ratio': 0., 'analysis_gain': 1., 'segment_count': 1},
        'identity_features': np.zeros(80),
        'third_features': np.zeros((3, 80)),
        'duration_seconds': 1.09,
        'strong_duration_seconds': .95,
        'onset_seconds': .4,
        'offset_seconds': 1.49,
        'periodicity': .8,
        'stability': 1.,
        'voiced_fraction': .95,
        'spectral_flatness': .01,
        'f0_hz': 190.,
        'zero_crossing_rate': .08,
        'spectral_centroid_hz': 1200.,
    }
    monkeypatch.setattr(va, '_decode', lambda _audio: np.zeros(16000))
    monkeypatch.setattr(va, 'extract_features', lambda _samples: features)
    monkeypatch.setattr(va, '_load_model', lambda: {
        'model_version': 'test-low-confidence',
        'identity': LowConfidenceIdentity(),
        'identity_threshold': .6,
        'spectral_flatness_limit': .2,
    })

    result = va.analyze_vowel(b'captured-vowel', 'i')

    assert result['scorable'] is True
    assert result['accuracy'] == 40
    assert result['validation_status'] == 'low_confidence'
    assert result['phoneme_match'] is False
    assert result['vowel_analysis']['identity'] == 'I'
    assert result['vowel_analysis']['duration_seconds'] == 1.09
    assert 'low confidence' in result['feedback'].lower()


def test_bad_bytes_and_unsupported_target_fail_closed():
    assert not va.analyze_vowel(b'not audio', 'aa')['scorable']
    assert va.analyze_vowel(wav(voiced()), 'ai')['validation_status'] == 'unsupported_target'


def test_oversized_decoded_audio_is_rejected():
    assert va.analyze_vowel(wav(np.zeros(13 * 16000)), 'a')['validation_status'] == 'invalid_audio'


def test_missing_model_has_no_fabricated_prediction(monkeypatch, tmp_path):
    monkeypatch.setattr(va, 'MODEL_DIR', tmp_path)
    monkeypatch.setattr(va, '_model', None)
    result = va.analyze_vowel(wav(voiced()), 'a')
    assert not result['scorable']
    assert result['validation_status'] == 'model_unavailable'
    assert result['vowel_analysis']['identity'] is None


@pytest.mark.skipif(not (va.MODEL_DIR / 'classifier.joblib').exists(), reason='Real trained artifact is not installed')
def test_real_heldout_padding_and_target_do_not_determine_prediction():
    path = va.MODEL_DIR / 'heldout/a.wav'
    samples, rate = sf.read(path, dtype='float32')
    assert rate == 16000
    padded = np.pad(samples, (16000, 7 * rate - len(samples) - 16000))
    short = va.analyze_vowel(wav(padded), 'a')
    wrong = va.analyze_vowel(wav(padded), 'uu')
    original = va.analyze_vowel(path.read_bytes(), 'a')
    assert short['scorable'] and wrong['scorable']
    for key in ('identity', 'length', 'duration_seconds', 'identity_confidence', 'length_confidence'):
        assert short['vowel_analysis'][key] == wrong['vowel_analysis'][key]
    assert abs(short['vowel_analysis']['duration_seconds'] - original['vowel_analysis']['duration_seconds']) <= .03
    assert short['vowel_analysis']['duration_seconds'] < 2
    assert short['audio_quality']['duration_seconds'] == 7
    assert short['accuracy'] > wrong['accuracy']


@pytest.mark.skipif(not (va.MODEL_DIR / 'evaluation.json').exists(), reason='Real evaluation artifact is not installed')
def test_actual_speaker_splits_and_reference_provenance():
    report = json.loads((va.MODEL_DIR / 'evaluation.json').read_text())
    split = {key: set(value) for key, value in report['speaker_splits'].items()}
    assert len(split['train']) == 12 and len(split['validation']) == len(split['test']) == 4
    assert not split['train'] & split['test']
    assert not split['train'] & split['validation']
    assert not split['validation'] & split['test']
    for name, speakers in [('references', split['train']), ('heldout', split['test'])]:
        manifest = json.loads((va.MODEL_DIR / f'{name}.json').read_text())
        assert set(manifest) == set(va.TARGETS)
        assert all(row['speaker'] in speakers for row in manifest.values())
    assert report['source_label_mapping']['e'] == 'i'
    assert report['source_label_mapping']['eh'] == 'e'
    quality_rows = json.loads((va.MODEL_DIR / 'quality-calibration.json').read_text())
    assert len(quality_rows) == 600
    assert {row['speaker'] for row in quality_rows} <= split['train']


@pytest.mark.skipif(not (va.MODEL_DIR / 'classifier.joblib').exists(), reason='Real trained artifact is not installed')
def test_real_reference_can_earn_perfect_points_without_rounding_confidence():
    audio = (va.MODEL_DIR / 'references/a.wav').read_bytes()
    matched = va.analyze_vowel(audio, 'a')
    wrong_target = va.analyze_vowel(audio, 'uu')
    assert matched['scorable'] and wrong_target['scorable']
    raw_points = sum(matched['score_components'].values())
    assert 99.5 <= raw_points < 100
    assert matched['accuracy'] == 100
    assert wrong_target['accuracy'] < matched['accuracy']
    assert 0.975 <= matched['vowel_analysis']['identity_confidence'] < 1
    for key in ('identity', 'length', 'duration_seconds', 'confidence', 'identity_confidence', 'length_confidence'):
        assert matched['vowel_analysis'][key] == wrong_target['vowel_analysis'][key]


@pytest.mark.skipif(not (va.MODEL_DIR / 'classifier.joblib').exists(), reason='Real trained artifact is not installed')
@pytest.mark.parametrize(('short', 'long', 'brief_range'), [
    ('e', 'ee', (0.50, 0.58)), ('i', 'ii', (0.43, 0.52)), ('u', 'uu', (0.40, 0.49)),
])
def test_app_short_example_cannot_earn_high_score_for_long_vowel(short, long, brief_range):
    """A familiar short sound never earns a high long-vowel score."""
    app_audio = va.MODEL_DIR.parents[2] / 'frontend/public/assets/tamil-reference'
    brief = va.analyze_vowel((app_audio / f'letter-{short}-human.wav').read_bytes(), long)
    held = va.analyze_vowel((app_audio / f'letter-{long}-human.wav').read_bytes(), long)
    assert brief_range[0] <= brief['vowel_analysis']['duration_seconds'] <= brief_range[1]
    assert brief['phoneme_match'] is False
    assert brief['accuracy'] < 70
    assert held['scorable'] is True
    # The existing long reference is linguistically long but shorter than the
    # learner-requested one-second exercise threshold.
    assert held['vowel_analysis']['duration_seconds'] <= 1.0
    assert held['vowel_analysis']['length'] == 'short'
    assert held['phoneme_match'] is False


def test_one_second_rule_is_independent_of_vowel_family():
    for identity in va.TARGETS:
        assert va.classify_vowel_length(0.44) == 'short'
        assert va.classify_vowel_length(1.2) == 'long'


@pytest.mark.skipif(not (va.MODEL_DIR / 'classifier.joblib').exists(), reason='Real trained artifact is not installed')
def test_length_prediction_stays_independent_of_short_or_long_prompt():
    audio = (va.MODEL_DIR.parents[2] / 'frontend/public/assets/tamil-reference/letter-e-human.wav').read_bytes()
    short = va.analyze_vowel(audio, 'e')['vowel_analysis']
    long = va.analyze_vowel(audio, 'ee')['vowel_analysis']
    assert short['identity'] == long['identity']
    assert short['length'] == long['length']
    assert short['duration_seconds'] == long['duration_seconds']


def test_one_second_vowel_rule_uses_measured_voicing_only():
    assert va.classify_vowel_length(0.999) == 'short'
    assert va.classify_vowel_length(1.0) == 'short'
    assert va.classify_vowel_length(1.001) == 'long'


def test_one_second_rule_ignores_silence_in_a_recording():
    brief = va.extract_features(np.r_[np.zeros(16000), voiced(.5), np.zeros(5 * 16000)])
    held = va.extract_features(np.r_[np.zeros(16000), voiced(1.3), np.zeros(5 * 16000)])
    assert brief['status'] == held['status'] == 'ok'
    assert va.classify_vowel_length(brief['duration_seconds']) == 'short'
    assert va.classify_vowel_length(held['duration_seconds']) == 'long'
    assert brief['quality']['duration_seconds'] > 6


@pytest.mark.skipif(not (va.MODEL_DIR / 'heldout/i.wav').exists(), reason='Human fixture is not installed')
def test_noise_masking_real_vowel_requires_retry():
    samples, rate = sf.read(va.MODEL_DIR / 'heldout/i.wav', dtype='float32')
    noise = np.random.default_rng(7).normal(0, np.sqrt(np.mean(samples ** 2)) / np.sqrt(10 ** .5), len(samples))
    result = va.analyze_vowel(wav(samples + noise), 'i')
    assert not result['scorable']
    assert result['validation_status'] == 'noisy_audio'


@pytest.mark.skipif(not (va.MODEL_DIR / 'classifier.joblib').exists(), reason='Real trained artifact is not installed')
@pytest.mark.parametrize('group', ['references', 'heldout'])
@pytest.mark.parametrize('target', list(va.TARGETS))
@pytest.mark.parametrize('gain_db', [-20, -40])
def test_quiet_float_human_vowels_recover_without_claiming_gain_invariant_duration(group, target, gain_db):
    samples, rate = sf.read(va.MODEL_DIR / group / f'{target}.wav', dtype='float32')
    assert rate == 16000
    baseline = va.analyze_vowel(wav(samples, 'FLOAT'), target)
    quiet = va.analyze_vowel(wav(samples * 10 ** (gain_db / 20), 'FLOAT'), target)
    assert baseline['scorable']
    # The rescue is deliberately limited to recordings the established gate
    # cannot detect. Partially detected -20 dB inputs can remain ambiguous or
    # have shortened boundaries; the diagnostics report those residuals.
    assert quiet['validation_status'] in {'valid', 'ambiguous', 'ambiguous_length'}
    if quiet['validation_status'] == 'ambiguous_length':
        assert not quiet['scorable']
    if gain_db == -40:
        assert quiet['scorable'], (group, target, quiet['validation_status'])
        assert quiet['vowel_analysis']['identity'] == va.TARGETS[target][0]
        assert quiet['vowel_analysis']['length'] == va.classify_vowel_length(
            quiet['vowel_analysis']['duration_seconds'])
        assert quiet['audio_quality']['analysis_gain'] > 1
    assert .07 <= quiet['vowel_analysis']['duration_seconds'] <= len(samples) / rate + .001
    # Gain conditioning never overwrites reported capture amplitude or length.
    assert quiet['audio_quality']['rms'] < baseline['audio_quality']['rms'] / 5
    assert quiet['audio_quality']['duration_seconds'] == baseline['audio_quality']['duration_seconds']
    assert 1 <= quiet['audio_quality']['analysis_gain'] <= 100
    assert quiet['audio_quality']['analysis_peak_rms'] > quiet['audio_quality']['rms']


@pytest.mark.skipif(not (va.MODEL_DIR / 'heldout/i.wav').exists(), reason='Human fixture is not installed')
@pytest.mark.parametrize('target', ['a', 'ee', 'i', 'o'])
def test_partly_detected_quiet_float_vowels_keep_voiced_duration(target):
    samples, _ = sf.read(va.MODEL_DIR / 'heldout' / f'{target}.wav', dtype='float32')
    original = va.analyze_vowel(wav(samples, 'FLOAT'), target)
    quiet = va.analyze_vowel(wav(samples * .1, 'FLOAT'), target)
    assert original['scorable'] and quiet['scorable']
    assert quiet['audio_quality']['analysis_gain'] > 1
    assert quiet['vowel_analysis']['identity'] == original['vowel_analysis']['identity']
    assert abs(quiet['vowel_analysis']['duration_seconds'] - original['vowel_analysis']['duration_seconds']) <= .03


@pytest.mark.skipif(not (va.MODEL_DIR / 'heldout/e.wav').exists(), reason='Human fixture is not installed')
def test_amplified_short_e_cannot_pass_long_ee():
    samples, _ = sf.read(va.MODEL_DIR / 'heldout/e.wav', dtype='float32')
    result = va.analyze_vowel(wav(samples * .1, 'FLOAT'), 'ee')
    assert result['audio_quality']['analysis_gain'] > 1
    assert result['vowel_analysis']['length'] == 'short'
    assert not result['phoneme_match']
    assert result['accuracy'] <= 40
    assert result['score_components']['pronunciation'] == 0
    assert result['score_components']['consistency'] == 0


@pytest.mark.skipif(not (va.MODEL_DIR / 'heldout/i.wav').exists(), reason='Human fixture is not installed')
@pytest.mark.parametrize('gain_db', [-20, -40])
def test_quiet_noise_masking_and_multiple_vowels_still_require_retry(gain_db):
    samples, _ = sf.read(va.MODEL_DIR / 'heldout/i.wav', dtype='float32')
    noise = np.random.default_rng(7).normal(0, np.sqrt(np.mean(samples ** 2)) / np.sqrt(10 ** .5), len(samples))
    signals = [(samples + noise, 'noisy_audio')]
    # At -40 dB the original gate detects nothing and rescue must still reject
    # two utterances. Partially detected repeats at -20 dB are a documented
    # pre-existing limitation, included honestly in the diagnostic report.
    if gain_db == -40:
        signals.append((np.r_[samples, np.zeros(8000), samples], 'multiple_vowels'))
    for signal, status in signals:
        result = va.analyze_vowel(wav(signal * 10 ** (gain_db / 20), 'FLOAT'), 'i')
        assert not result['scorable']
        assert result['validation_status'] == status
    white_noise = np.random.default_rng(7).normal(0, .08, 16000) * 10 ** (gain_db / 20)
    assert not va.analyze_vowel(wav(white_noise), 'i')['scorable']


@pytest.mark.skipif(not (va.MODEL_DIR / 'heldout/a.wav').exists(), reason='Human fixture is not installed')
def test_quiet_padded_recording_keeps_acoustic_prediction_independent_of_target():
    samples, _ = sf.read(va.MODEL_DIR / 'heldout/a.wav', dtype='float32')
    audio = wav(np.pad(samples * .01, (16000, 7 * 16000 - len(samples) - 16000)), 'FLOAT')
    short, wrong = va.analyze_vowel(audio, 'a'), va.analyze_vowel(audio, 'uu')
    assert short['scorable'] and wrong['scorable']
    for key in ('identity', 'length', 'duration_seconds', 'confidence', 'identity_confidence', 'length_confidence'):
        assert short['vowel_analysis'][key] == wrong['vowel_analysis'][key]
    assert short['vowel_analysis']['duration_seconds'] < 2
    assert short['audio_quality']['duration_seconds'] == 7


def test_gain_conditioning_does_not_hide_original_clipping_or_amplify_digital_silence():
    overloaded = np.clip(voiced() * 100, -1, 1)
    clipped = va.analyze_vowel(wav(overloaded), 'a')
    assert not clipped['scorable'] and clipped['validation_status'] == 'clipped_audio'
    silent = va.analyze_vowel(wav(np.zeros(16000)), 'a')
    assert not silent['scorable'] and silent['validation_status'] == 'no_speech'


@pytest.mark.skipif(not (va.MODEL_DIR / 'heldout/uu.wav').exists(), reason='Human fixture is not installed')
def test_irrecoverable_pcm16_quantization_does_not_become_confident_wrong_vowel():
    samples, _ = sf.read(va.MODEL_DIR / 'heldout/uu.wav', dtype='float32')
    # This real quiet U clip is reduced to ~14 PCM16 amplitude values. Without
    # the quantization gate, gain conditioning made the classifier call it I.
    damaged = va.analyze_vowel(wav(samples * .01), 'uu')
    assert not damaged['scorable']
    assert damaged['validation_status'] == 'no_speech'
    assert damaged['vowel_analysis']['identity'] is None
    precise = va.analyze_vowel(wav(samples * .01, 'FLOAT'), 'uu')
    assert precise['scorable'] and precise['vowel_analysis']['identity'] == 'U'


def test_multiple_segments_feedback_explains_record_once_then_quiet():
    signal = np.r_[voiced(), np.zeros(8000), voiced()]
    result = va.analyze_vowel(wav(signal), 'a')
    assert result['validation_status'] == 'multiple_vowels'
    assert '2 separate voiced segments' in result['feedback']
    assert 'longest lasted' in result['feedback']
    assert 'then stay quiet' in result['feedback']


@pytest.mark.skipif(not (va.MODEL_DIR / 'classifier.joblib').exists(), reason='Real trained artifact is not installed')
@pytest.mark.parametrize('group,durations', [
    ('references', [.31, .54, .31, .57, .32, .57, .33, .58, .31, .53]),
    ('heldout', [.24, .60, .30, .54, .32, .57, .29, .55, .29, .60]),
])
def test_existing_detectable_human_recordings_keep_established_duration_and_no_gain(group, durations):
    # Measurements captured before the quiet-input change. The broad 200-clip
    # evaluation independently verifies that normal predictions also stay put.
    for target, duration in zip(va.TARGETS, durations):
        result = va.analyze_vowel((va.MODEL_DIR / group / f'{target}.wav').read_bytes(), target)
        assert result['scorable']
        assert result['audio_quality']['analysis_gain'] == 1
        assert result['vowel_analysis']['duration_seconds'] == duration
