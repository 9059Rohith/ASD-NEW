"""Isolated Tamil vowel acoustics, with identity and measured length.

Training/evaluation: scripts/vowel_train.py. No transcript, target conditioning of
the predictions, or capture-window duration is used to guess a vowel label.
"""
from __future__ import annotations

import io
import json
import math
import threading
from pathlib import Path

import numpy as np
from scipy.fft import dct
from scipy.ndimage import binary_closing
from scipy.signal import resample_poly

SAMPLE_RATE = 16000
MODEL_DIR = Path(__file__).resolve().parents[2] / 'models' / 'vowel-classifier'
TARGETS = {v * n: (v.upper(), 'short' if n == 1 else 'long') for v in 'aeiou' for n in (1, 2)}
VOWEL_LENGTH_BOUNDARY_SECONDS = 1.0
_model = None
_model_lock = threading.Lock()


def _decode(data):
    import soundfile as sf
    if not data or len(data) > 5 * 1024 * 1024:
        raise ValueError('The recording is empty or too large.')
    try:
        with sf.SoundFile(io.BytesIO(data)) as source:
            sr = source.samplerate
            if source.frames / sr > 12:
                raise ValueError('Please record no more than twelve seconds.')
            samples = source.read(dtype='float32', always_2d=True).mean(axis=1)
    except (sf.LibsndfileError, RuntimeError):
        import av
        chunks, count = [], 0
        with av.open(io.BytesIO(data)) as container:
            converter = av.AudioResampler(format='fltp', layout='mono', rate=SAMPLE_RATE)
            for frame in container.decode(audio=0):
                for converted in converter.resample(frame):
                    chunk = converted.to_ndarray().ravel()
                    count += len(chunk)
                    if count > 12 * SAMPLE_RATE:
                        raise ValueError('Please record no more than twelve seconds.')
                    chunks.append(chunk)
            for converted in converter.resample(None):
                chunks.append(converted.to_ndarray().ravel())
        samples = np.concatenate(chunks) if chunks else np.array([], dtype='float32')
        sr = SAMPLE_RATE
    if not len(samples) or not np.isfinite(samples).all() or len(samples) / sr > 12:
        raise ValueError('The recording contains no valid bounded audio.')
    if sr != SAMPLE_RATE:
        divisor = math.gcd(sr, SAMPLE_RATE)
        samples = resample_poly(samples, SAMPLE_RATE // divisor, sr // divisor)
    return np.asarray(samples, dtype='float32')


def _runs(mask):
    changes = np.diff(np.r_[False, mask, False].astype(int))
    return list(zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)))


def classify_vowel_length(voiced_seconds):
    """Apply the lesson rule to the detected vowel, excluding capture silence."""
    return 'long' if voiced_seconds > VOWEL_LENGTH_BOUNDARY_SECONDS else 'short'


def extract_features(samples):
    """10 ms hop; energy + normalized autocorrelation mark vowel onset/offset.

    MFCC features exclude c0 and absolute gain. Duration is a separate feature,
    absent from the identity classifier. Quality gates are not learned labels.
    """
    samples = np.asarray(samples, dtype=np.float64)
    hop, window = 160, 480
    padded = np.pad(samples, (0, max(0, window - len(samples))))
    frames = np.lib.stride_tricks.sliding_window_view(padded, window)[::hop].copy()
    frames -= frames.mean(axis=1, keepdims=True)
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    peak_rms = float(rms.max(initial=0))
    analysis_gain = 1.
    ac = np.fft.irfft(np.abs(np.fft.rfft(frames, n=1024)) ** 2, n=1024)[:, :window]
    periodicity = np.max(ac[:, 32:267] / np.maximum(ac[:, :1], 1e-12), axis=1)
    peak = peak_rms
    # Preserve normal-level segmentation. Very quiet recordings can yield a
    # truncated run even when one was found, so condition only those captures.
    energy_gate = max(.0025, peak * .10)
    active = (rms > energy_gate) & (periodicity > .38)
    # Close only <=50 ms gaps; distinct utterances remain separate segments.
    closed = binary_closing(np.pad(active, (4, 4)), structure=np.ones(6))[4:-4]
    runs = [(a, b) for a, b in _runs(closed) if b - a >= 7]
    if 0 < peak_rms < .025 and (not runs or peak_rms < .006):
        # A bounded rescue for undetected or severely truncated quiet speech.
        # No pitch/time modification; original samples remain untouched for
        # capture quality. Noise/voicing/confidence gates remain mandatory.
        analysis_gain = min(100., .025 / peak_rms)
        frames *= analysis_gain
        rms *= analysis_gain
        ac = np.fft.irfft(np.abs(np.fft.rfft(frames, n=1024)) ** 2, n=1024)[:, :window]
        periodicity = np.max(ac[:, 32:267] / np.maximum(ac[:, :1], 1e-12), axis=1)
        peak = float(rms.max(initial=0))
        active = (rms > max(.000025, peak * .10)) & (periodicity > .38)
        closed = binary_closing(np.pad(active, (4, 4)), structure=np.ones(6))[4:-4]
        runs = [(a, b) for a, b in _runs(closed) if b - a >= 7]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(window), n=1024)) ** 2
    quality = {'duration_seconds': round(len(samples) / SAMPLE_RATE, 4),
               'peak': float(np.max(np.abs(samples), initial=0)),
               'rms': float(np.sqrt(np.mean(samples ** 2))) if len(samples) else 0.,
               'analysis_gain': round(analysis_gain, 4),
               'analysis_peak_rms': round(peak, 6),
               'clipping_ratio': float(np.mean(np.abs(samples) >= .995)) if len(samples) else 0.,
               'segment_count': len(runs)}
    # A PCM16 signal spanning at most 32 amplitude steps has already discarded
    # most fine spectral detail. Increasing its gain cannot restore it, and
    # can produce a confident wrong identity. Float captures do not share this
    # quantization grid and can be safely gained before PCM encoding upstream.
    quantized = samples * 32768
    if (len(samples) and np.ptp(quantized) <= 32
            and np.all(np.abs(quantized - np.rint(quantized)) < 1e-6)):
        return {'status': 'no_speech', 'quality': quality}
    if not runs:
        return {'status': 'noisy_audio' if peak > .02 else 'no_speech', 'quality': quality}
    start, stop = max(runs, key=lambda r: r[1] - r[0])
    meaningful = [(a, b) for a, b in runs if b - a >= max(9, (stop - start) * .15)]
    start_sample, end_sample = start * hop, min(len(samples), (stop - 1) * hop + window)
    chosen = np.arange(start, stop)
    core = chosen[active[chosen]]
    duration = (end_sample - start_sample) / SAMPLE_RATE
    # Keep a separate core measurement for diagnostics. The displayed voiced
    # duration above is the sole input to the one-second length rule.
    strong = (rms > peak * .40) & (periodicity > .38)
    strong_closed = binary_closing(np.pad(strong, (4, 4)), structure=np.ones(6))[4:-4]
    strong_runs = [(a, b) for a, b in _runs(strong_closed) if b - a >= 7 and a >= start and b <= stop]
    strong_duration = max((((b - 1) * hop + window - a * hop) / SAMPLE_RATE for a, b in strong_runs), default=0.)
    mel_edges = 700 * (10 ** (np.linspace(2595 * np.log10(1 + 80 / 700), 2595 * np.log10(1 + 7600 / 700), 42) / 2595) - 1)
    hz = np.fft.rfftfreq(1024, 1 / SAMPLE_RATE)
    bank = np.maximum(0, np.minimum((hz[None, :] - mel_edges[:-2, None]) / (mel_edges[1:-1, None] - mel_edges[:-2, None]),
                                   (mel_edges[2:, None] - hz[None, :]) / (mel_edges[2:, None] - mel_edges[1:-1, None])))
    mel = np.log(np.maximum(spectrum[core] @ bank.T, 1e-10))
    cepstra = dct(mel, type=2, norm='ortho', axis=1)[:, 1:21]
    thirds = np.array_split(cepstra, 3)
    identity = np.r_[np.mean(cepstra, axis=0), np.std(cepstra, axis=0),
                     np.percentile(cepstra, 25, axis=0), np.percentile(cepstra, 75, axis=0)]
    third_features = [np.r_[part.mean(axis=0), part.std(axis=0), np.percentile(part, 25, axis=0),
                            np.percentile(part, 75, axis=0)] for part in thirds if len(part)]
    stability = float(np.mean(np.std(cepstra[:, :12], axis=0)))
    harmonicity = float(np.median(periodicity[core]))
    f0_hz = float(np.median(SAMPLE_RATE / (np.argmax(ac[core, 32:267], axis=1) + 32)))
    zero_crossing_rate = float(np.mean(np.diff(np.signbit(frames[core]), axis=1)))
    spectral_centroid_hz = float(np.median(np.sum(spectrum[core] * hz, axis=1) / np.maximum(spectrum[core].sum(axis=1), 1e-12)))
    flatness = float(np.median(np.exp(np.mean(np.log(np.maximum(spectrum[core, 4:], 1e-12)), axis=1)) /
                               np.maximum(np.mean(spectrum[core, 4:], axis=1), 1e-12)))
    status = 'ok'
    if len(meaningful) > 1:
        status = 'multiple_vowels'
    elif quality['clipping_ratio'] > .03:
        status = 'clipped_audio'
    elif harmonicity < .45 or len(core) / len(chosen) < .6:
        status = 'noisy_audio'
    return {'status': status, 'quality': quality, 'identity_features': identity,
            'third_features': third_features, 'duration_seconds': duration,
            'strong_duration_seconds': strong_duration,
            'onset_seconds': start_sample / SAMPLE_RATE, 'offset_seconds': end_sample / SAMPLE_RATE,
            'periodicity': harmonicity, 'stability': stability, 'voiced_fraction': len(core) / len(chosen),
            'spectral_flatness': flatness,
            'f0_hz': f0_hz, 'zero_crossing_rate': zero_crossing_rate,
            'spectral_centroid_hz': spectral_centroid_hz}


def _load_model():
    global _model
    with _model_lock:
        if _model is None:
            import joblib
            artifact = joblib.load(MODEL_DIR / 'classifier.joblib')
            if artifact.get('schema_version') != 1:
                raise ValueError('Unsupported vowel model artifact')
            # Tiny inference batches are faster without creating a worker pool
            # for every forest prediction. This does not change trained trees.
            for calibrated in artifact['identity'].calibrated_classifiers_:
                if hasattr(calibrated.estimator, 'n_jobs'):
                    calibrated.estimator.n_jobs = 1
            _model = artifact
    return _model


def get_model_status():
    try:
        model = _load_model()
        from .diphthong_analysis import get_model_status as get_diphthong_status
        diphthongs = get_diphthong_status()
        return {'status': 'ready', 'model_version': model['model_version'],
                'source': 'Tamil vowels-speech database', 'license': 'CC BY 4.0',
                'evaluation': {'identity': model.get('evaluation_summary', {}).get('identity')},
                'length_rule': {'voiced_seconds_greater_than': VOWEL_LENGTH_BOUNDARY_SECONDS,
                                'note': 'No held-out accuracy claim is available for this requested duration rule.'},
                'diphthongs': diphthongs,
                'all_twelve_ready': diphthongs['status'] == 'ready'}
    except Exception:
        return {'status': 'unavailable', 'model_version': None, 'all_twelve_ready': False}


def get_reference_clips():
    path = MODEL_DIR / 'references.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def analyze_vowel(audio_bytes: bytes, target_phoneme: str) -> dict:
    target = str(target_phoneme).strip().lower()
    expected = TARGETS.get(target, (None, None))
    analysis = {'identity': None, 'length': None, 'duration_seconds': None,
                'confidence': 0., 'identity_confidence': 0., 'length_confidence': 0.,
                'target_identity': expected[0], 'target_length': expected[1],
                'identity_match': False, 'length_match': False}
    result = {'accuracy': 0., 'scorable': False, 'phoneme_match': False, 'feedback': '',
              'validation_status': 'invalid_audio', 'vowel_analysis': analysis,
              'score_components': {'identity': 0., 'duration': 0., 'pronunciation': 0., 'consistency': 0.},
              'score_method': 'real-data-independent-vowel-v1', 'model_version': None}
    if target not in TARGETS:
        result.update(validation_status='unsupported_target', feedback='Choose a short or long A, E, I, O or U vowel.')
        return result
    try:
        samples = _decode(audio_bytes)
        features = extract_features(samples)
    except Exception:
        result['feedback'] = 'The audio could not be read. Please record again for seven seconds.'
        return result
    result['audio_quality'] = features['quality']
    if 'duration_seconds' in features:
        analysis['duration_seconds'] = round(features['duration_seconds'], 3)
        analysis['strong_duration_seconds'] = round(features['strong_duration_seconds'], 3)
        result['debug_features'] = {k: round(float(features[k]), 4) for k in
                                    ('onset_seconds', 'offset_seconds', 'periodicity', 'stability', 'voiced_fraction', 'spectral_flatness', 'f0_hz', 'zero_crossing_rate', 'spectral_centroid_hz')}
        result['debug_features']['rms'] = round(features['quality']['rms'], 6)
    if features['status'] != 'ok':
        guidance = {'no_speech': 'No clear vowel was heard. Move closer and say one vowel.',
                    'noisy_audio': 'Background noise or unclear voicing prevented a reliable result. Try a quieter place.',
                    'multiple_vowels': (f"Heard {features['quality']['segment_count']} separate voiced segments. "
                                        f"The longest lasted {features.get('duration_seconds', 0):.2f} seconds. "
                                        'Say the vowel once, then stay quiet while the recording finishes.'),
                    'clipped_audio': 'The microphone was overloaded. Move slightly farther away and try again.'}
        result.update(validation_status=features['status'], feedback=guidance[features['status']])
        return result
    try:
        model = _load_model()
    except Exception:
        result.update(validation_status='model_unavailable', feedback='The vowel model is unavailable. Your recording has not been scored.')
        return result
    result['model_version'] = model['model_version']
    if features['spectral_flatness'] > model.get('spectral_flatness_limit', 1.):
        result.update(validation_status='noisy_audio', feedback='Noise is masking the vowel. Move to a quieter place and record again.')
        return result
    # A separate trained AI/AU/other model prevents confident diphthongs being
    # forced into this five-identity classifier. Paired weights stay unchanged.
    # Missing auxiliary retains the established paired capability; the dedicated
    # AI/AU endpoint explicitly fails unavailable in that case.
    try:
        from .diphthong_analysis import classify_features
        diphthong = classify_features(features)
    except Exception:
        diphthong = None
    if diphthong and diphthong['identity'] in {'AI', 'AU'} and diphthong['confidence'] >= diphthong['threshold']:
        analysis.update(identity=diphthong['identity'], length=None,
                        confidence=round(diphthong['confidence'], 4),
                        identity_confidence=round(diphthong['confidence'], 4))
        result.update(validation_status='diphthong_detected', model_version=diphthong['model_version'],
                      feedback=f"Heard {'ஐ' if diphthong['identity'] == 'AI' else 'ஔ'}. Listen to the requested vowel and try again.")
        return result
    probabilities = model['identity'].predict_proba(features['identity_features'][None, :])[0]
    identity_index = int(probabilities.argmax())
    identity = str(model['identity'].classes_[identity_index])
    # Identity comes from the acoustic model. Length follows the learner's
    # explicit >1 second rule on the same voiced interval shown in the UI.
    length = classify_vowel_length(features['duration_seconds'])
    confidence = float(probabilities.max())
    analysis.update(identity=identity, length=length, confidence=round(confidence, 4),
                    identity_confidence=round(confidence, 4), length_confidence=None,
                    length_method='voiced_duration_over_one_second', length_boundary_seconds=VOWEL_LENGTH_BOUNDARY_SECONDS,
                    identity_match=identity == expected[0], length_match=length == expected[1])
    thirds = model['identity'].predict_proba(np.asarray(features['third_features']))
    consistency = float(np.mean(thirds.argmax(axis=1) == identity_index))
    low_confidence = confidence < model['identity_threshold']
    if consistency < 2 / 3:
        result.update(validation_status='unstable_vowel', feedback='The vowel sound changed during the recording. Keep one vowel shape and try again.')
        return result
    ident_match, len_match = analysis['identity_match'], analysis['length_match']
    # Educational points, not clinical pronunciation or confidence percentages.
    # A learner must match both the vowel and its requested length before
    # pronunciation/consistency bonuses are awarded. Identity-only partial
    # credit cannot turn a short E into a successful long EE attempt.
    matched = ident_match and len_match
    components = {'identity': 40. if ident_match else 0., 'duration': 30. if len_match else 0.,
                  'pronunciation': round(20 * confidence if matched else 0., 2),
                  'consistency': round(10 * consistency if matched else 0., 2)}
    feedback = f'Heard {identity}, {length}, for {features["duration_seconds"]:.2f} seconds. '
    if low_confidence:
        feedback += 'The vowel identity was detected with low confidence, so this is a conservative score. '
    if not ident_match:
        feedback += f'Listen again and aim for {expected[0]}. '
    if not len_match:
        feedback += 'Keep the voiced sound at or under 1.00 second.' if expected[1] == 'short' else 'Hold the voiced sound beyond 1.00 second.'
    if ident_match and len_match:
        feedback += 'Your vowel and length matched the target.'
    # Whole educational points match the displayed score and make a perfect
    # reward reachable without claiming a calibrated probability of exactly 1.
    # Round the unchanged component sum once; half points round upward.
    result.update(accuracy=math.floor(sum(components.values()) + .5), scorable=True,
                  validation_status='low_confidence' if low_confidence else 'valid',
                  phoneme_match=ident_match and len_match, score_components=components, feedback=feedback)
    return result
