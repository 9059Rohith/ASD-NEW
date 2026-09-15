"""API boundary tests. Acoustic scoring regressions live in test_phoneme_pipeline."""
import pytest
import io
import wave
from pathlib import Path
import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers import evaluation as evaluation_router
from app.routers.evaluation import validate_lesson_target
from app.utils.jwt_handler import get_current_user


def _client():
    app = FastAPI()
    app.include_router(evaluation_router.router)
    app.dependency_overrides[get_current_user] = lambda: {'_id': 'child-1'}
    evaluation_router.speech_rate_limit._hits.clear()
    return TestClient(app)


def _quiet_reference(letter, gain=0.02):
    reference = Path(__file__).resolve().parents[2] / 'frontend' / 'public' / 'assets' / 'tamil-reference' / f'letter-{letter}-human.wav'
    with wave.open(str(reference), 'rb') as source:
        parameters = source.getparams()
        samples = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2')
    output = io.BytesIO()
    with wave.open(output, 'wb') as target:
        target.setparams(parameters)
        target.writeframes((samples.astype(np.float64) * gain).astype('<i2').tobytes())
    return output.getvalue()


@pytest.mark.parametrize(('lesson_id', 'letter'), [(1, 'a')])
def test_training_vowel_scores_quiet_human_recording_with_vowel_model(lesson_id, letter):
    response = _client().post('/api/evaluate/speech',
        data={'target_phoneme': letter, 'lesson_id': str(lesson_id)},
        files={'audio': ('recording.wav', _quiet_reference(letter), 'audio/wav')})
    assert response.status_code == 200
    result = response.json()
    assert result['score_method'] == 'real-data-independent-vowel-v1'
    assert result['scorable'] is True
    assert result['phoneme_match'] is True
    assert result['vowel_analysis']['identity_match'] is True
    assert result['vowel_analysis']['length_match'] is True
    assert result['evaluation_receipt']


def test_training_diphthong_uses_diphthong_identity_model(monkeypatch):
    calls = []
    def fake_analyze(audio, target):
        calls.append((audio, target))
        return {'score_method': 'diphthong_identity_match_v1', 'accuracy': 100,
                'scorable': True, 'phoneme_match': True}
    monkeypatch.setattr(evaluation_router, 'analyze_diphthong', fake_analyze, raising=False)
    response = _client().post('/api/evaluate/speech',
        data={'target_phoneme': 'ai', 'lesson_id': '9'},
        files={'audio': ('recording.wav', b'RIFF-audio', 'audio/wav')})
    assert response.status_code == 200
    assert response.json()['score_method'] == 'diphthong_identity_match_v1'
    assert calls == [(b'RIFF-audio', 'ai')]


def test_training_quiet_long_reference_follows_measured_one_second_rule():
    response = _client().post('/api/evaluate/speech',
        data={'target_phoneme': 'a', 'lesson_id': '1'},
        files={'audio': ('recording.wav', _quiet_reference('aa'), 'audio/wav')})
    assert response.status_code == 200
    result = response.json()
    assert result['scorable'] is True
    assert result['vowel_analysis']['identity_match'] is True
    assert result['vowel_analysis']['duration_seconds'] <= 1.0
    assert result['vowel_analysis']['length_match'] is True
    assert result['phoneme_match'] is True


def test_training_brief_e_does_not_reward_long_ee_lesson():
    example = Path(__file__).resolve().parents[2] / 'frontend/public/assets/tamil-reference/letter-e-human.wav'
    response = _client().post('/api/evaluate/speech',
        data={'target_phoneme': 'ee', 'lesson_id': '8'},
        files={'audio': ('recording.wav', example.read_bytes(), 'audio/wav')})
    assert response.status_code == 200
    result = response.json()
    assert result['validation_status'] == 'valid'
    assert result['scorable'] is True
    assert result['phoneme_match'] is False
    assert result['accuracy'] < 70
    assert result['vowel_analysis']['length'] == 'short'
    assert result['stars_earned'] == 0


def test_lesson_id_and_phoneme_must_match_the_authored_curriculum():
    assert validate_lesson_target(1, ' A ') == 'a'
    assert validate_lesson_target(14, 'APPA') == 'appa'
    with pytest.raises(ValueError):
        validate_lesson_target(1, 'aa')
    with pytest.raises(ValueError):
        validate_lesson_target(99, 'a')


def test_speech_route_forwards_transcript_and_canonical_target(monkeypatch):
    calls = []

    class FakeEvaluator:
        def evaluate_pronunciation(self, audio, target, browser_transcript):
            calls.append((audio, target, browser_transcript))
            return {
                'accuracy': 88,
                'phoneme_match': True,
                'validation_status': 'validated',
            }

    monkeypatch.setattr(evaluation_router, 'speech_evaluator', FakeEvaluator())
    app = FastAPI()
    app.include_router(evaluation_router.router)
    app.dependency_overrides[get_current_user] = lambda: {'_id': 'child-1'}
    client = TestClient(app)

    response = client.post(
        '/api/evaluate/speech',
        data={
            'target_phoneme': 'APPA',
            'lesson_id': '14',
            'browser_transcript': 'அப்பா',
        },
        files={'audio': ('recording.wav', b'RIFF-audio', 'audio/wav')},
    )

    assert response.status_code == 200
    assert response.json()['target_phoneme'] == 'appa'
    assert calls == [(b'RIFF-audio', 'appa', 'அப்பா')]
