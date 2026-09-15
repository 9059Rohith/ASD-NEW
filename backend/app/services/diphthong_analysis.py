"""Independent AI/AU/other acoustics; shares bounded vowel signal gates."""
from pathlib import Path
import threading
import numpy as np

MODEL_DIR = Path(__file__).resolve().parents[2] / 'models' / 'diphthong-classifier'
_model = None
_lock = threading.Lock()
PHONES = {'AI': 'aɪ', 'AU': 'aʊ'}


def _load_model():
    global _model
    with _lock:
        if _model is None:
            import joblib
            artifact = joblib.load(MODEL_DIR / 'classifier.joblib')
            if artifact.get('schema_version') != 1 or not artifact.get('deployment_gate_passed'):
                raise ValueError('Auxiliary model has not passed its validation gate')
            for calibrated in artifact['identity'].calibrated_classifiers_:
                calibrated.estimator.n_jobs = 1
            _model = artifact
        return _model


def classify_features(features):
    """No requested target, duration, or transcript participates in recognition."""
    model = _load_model()
    vector = features['identity_features']
    if model.get('feature_schema') == 'mfcc80_delta20':
        vector = np.r_[vector, features['third_features'][-1][:20] - features['third_features'][0][:20]]
    probabilities = model['identity'].predict_proba(vector[None, :])[0]
    return {'identity': str(model['identity'].classes_[int(np.argmax(probabilities))]),
            'confidence': float(np.max(probabilities)), 'threshold': model['confidence_threshold'],
            'model_version': model['model_version'], 'spectral_flatness_limit': model['spectral_flatness_limit']}


def get_model_status():
    try:
        model = _load_model()
        return {'status': 'ready', 'model_version': model['model_version'], 'evaluation': model['evaluation_summary']}
    except Exception:
        return {'status': 'unavailable', 'model_version': None}


def analyze_diphthong(audio_bytes, target):
    from .vowel_analysis import _decode, extract_features
    expected = str(target).strip().upper()
    result = {'accuracy': None, 'scorable': False, 'phoneme_match': False,
              'actual_phonemes': [], 'expected_phonemes': [PHONES[expected]] if expected in PHONES else [],
              'confidence': None, 'detected_vowel': None, 'active_duration_ms': None,
              'validation_status': 'invalid_audio', 'feedback': '', 'phoneme_alignment': [], 'phoneme_errors': [],
              'score_method': 'diphthong_identity_match_v1', 'validation_source': 'acoustic_diphthong_model'}
    if expected not in PHONES:
        return {**result, 'validation_status': 'unsupported_target', 'feedback': 'Choose ஐ or ஔ.'}
    try:
        features = extract_features(_decode(audio_bytes))
    except Exception:
        return {**result, 'feedback': 'The recording could not be read. Please record again.'}
    quality = features['quality']
    duration = features.get('duration_seconds', 0.)
    result.update(audio_quality={**quality, 'has_speech': features['status'] == 'ok',
                                'active_duration_seconds': duration}, active_duration_ms=round(duration * 1000))
    if features['status'] != 'ok':
        guidance = {'no_speech': 'No clear vowel was heard. Move closer and say one vowel.',
                    'multiple_vowels': 'Say the vowel once, then stay quiet while recording finishes.',
                    'clipped_audio': 'The microphone was overloaded. Move slightly farther away.',
                    'noisy_audio': 'Noise is masking the vowel. Try a quieter place.'}
        return {**result, 'validation_status': features['status'], 'feedback': guidance[features['status']]}
    try:
        prediction = classify_features(features)
    except Exception:
        return {**result, 'validation_status': 'model_unavailable',
                'feedback': 'The vowel model is unavailable. Your recording has not been scored.'}
    result.update(model_id=prediction['model_version'], confidence=round(prediction['confidence'], 4))
    if features['spectral_flatness'] > prediction['spectral_flatness_limit']:
        return {**result, 'validation_status': 'noisy_audio', 'feedback': 'Noise is masking the vowel. Try a quieter place.'}
    if prediction['confidence'] < prediction['threshold']:
        return {**result, 'validation_status': 'ambiguous', 'feedback': 'The vowel was unclear. Listen to the example and try again.'}
    identity = prediction['identity']
    actual = PHONES.get(identity)
    matched = identity == expected
    alignment = [{'expected': PHONES[expected], 'actual': actual, 'operation': 'correct' if matched else 'substitution'}]
    # Binary educational identity match; confidence remains an independent
    # calibrated probability. This is not IPA edit or a pronunciation percentage.
    return {**result, 'scorable': True, 'accuracy': 100 if matched else 0, 'phoneme_match': matched,
            'actual_phonemes': [actual] if actual else [], 'detected_vowel': identity,
            'correct_phonemes': int(matched), 'total_phonemes': 1, 'edit_distance': int(not matched),
            'phoneme_alignment': alignment, 'phoneme_errors': [] if matched else alignment,
            'validation_status': 'validated' if matched else 'not_matched',
            'feedback': ('The detected vowel matches the target. Well done!' if matched else
                         f"Heard {'ஐ' if identity == 'AI' else 'ஔ' if identity == 'AU' else 'another vowel'}. Listen to the example and try again.")}
