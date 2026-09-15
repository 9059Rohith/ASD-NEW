"""Contract and rejection tests; model accuracy is reported on human speaker splits."""
import io
import numpy as np
import pytest
import soundfile as sf
from app.services import vowel_analysis as va

def wav(audio):
    out=io.BytesIO();sf.write(out,audio,16000,format='WAV',subtype='FLOAT');return out.getvalue()

def real_audio():
    return sf.read(va.MODEL_DIR/'heldout/a.wav',dtype='float32')[0]

def test_confident_diphthong_vetoes_paired_vowel(monkeypatch):
    from app.services import diphthong_analysis as da
    monkeypatch.setattr(da,'classify_features',lambda features:dict(identity='AI',confidence=.92,threshold=.6,model_version='test',spectral_flatness_limit=1.))
    result=va.analyze_vowel(wav(real_audio()),'a')
    assert not result['scorable']
    assert result['validation_status']=='diphthong_detected'
    assert result['vowel_analysis']['identity']=='AI'
    assert result['vowel_analysis']['length'] is None
    assert result['accuracy']==0

def test_diphthong_prediction_is_target_independent_and_other_is_mismatch(monkeypatch):
    from app.services import diphthong_analysis as da
    monkeypatch.setattr(da,'classify_features',lambda features:dict(identity='AI',confidence=.84,threshold=.6,model_version='test',spectral_flatness_limit=1.))
    left=da.analyze_diphthong(wav(real_audio()),'ai');right=da.analyze_diphthong(wav(real_audio()),'au')
    assert left['actual_phonemes']==right['actual_phonemes']==['aɪ']
    assert left['confidence']==right['confidence']==.84
    assert left['accuracy']==100 and right['accuracy']==0
    monkeypatch.setattr(da,'classify_features',lambda features:dict(identity='OTHER',confidence=.84,threshold=.6,model_version='test',spectral_flatness_limit=1.))
    other=da.analyze_diphthong(wav(real_audio()),'ai')
    assert other['scorable'] and not other['phoneme_match'] and other['accuracy']==0
    assert other['detected_vowel']=='OTHER'

def test_weak_or_missing_diphthong_model_never_scores(monkeypatch):
    from app.services import diphthong_analysis as da
    monkeypatch.setattr(da,'classify_features',lambda features:dict(identity='AI',confidence=.59,threshold=.6,model_version='test',spectral_flatness_limit=1.))
    assert not da.analyze_diphthong(wav(real_audio()),'ai')['scorable']
    def unavailable(_features):raise FileNotFoundError('missing')
    monkeypatch.setattr(da,'classify_features',unavailable)
    assert da.analyze_diphthong(wav(real_audio()),'ai')['validation_status']=='model_unavailable'

@pytest.mark.parametrize('kind',['silence','noise','repeated','clipped'])
def test_invalid_diphthong_audio_does_not_reach_classifier(monkeypatch,kind):
    from app.services import diphthong_analysis as da
    audio=real_audio()
    signals=dict(silence=np.zeros(112000),noise=np.random.default_rng(5).normal(0,.1,16000),
                 repeated=np.r_[audio,np.zeros(8000),audio],clipped=np.clip(audio/max(abs(audio))*8,-1,1))
    def unexpected(_features):pytest.fail('Invalid audio reached classifier')
    monkeypatch.setattr(da,'classify_features',unexpected)
    assert not da.analyze_diphthong(wav(signals[kind]),'au')['scorable']

def test_phoneme_speech_presence_is_not_diluted_by_capture_silence():
    from app.services.phoneme_pipeline import decode_audio
    audio=.02*np.sin(np.arange(3200)*2*np.pi*220/16000)
    _,original=decode_audio(wav(audio))
    _,padded=decode_audio(wav(np.pad(audio,(16000,92800))))
    assert original['has_speech'] and padded['has_speech']
    assert padded['rms']<.004
    assert original['active_duration_seconds']==padded['active_duration_seconds']

def test_tamil_routes_diphthongs_to_auxiliary_and_retains_word_engine(monkeypatch):
    from app.routers import tamil
    from app.services import diphthong_analysis as da
    from app.services.phoneme_pipeline import phoneme_evaluator
    calls=[]
    monkeypatch.setattr(da,'analyze_diphthong',lambda data,target:calls.append(('vowel',target)) or {'scorable':False})
    monkeypatch.setattr(phoneme_evaluator,'evaluate_pronunciation',lambda data,target:calls.append(('word',target)) or {'scorable':False})
    tamil.evaluate_audio(b'audio','ai');tamil.evaluate_audio(b'audio','au');tamil.evaluate_audio(b'audio','amma')
    assert calls==[('vowel','ai'),('vowel','au'),('word','amma')]

@pytest.mark.parametrize('target',['ai','au'])
def test_real_diphthong_fixture_padding_quiet_and_prompt_independence(target):
    from app.services import diphthong_analysis as da
    path=da.MODEL_DIR/'heldout'/f'{target}.wav'
    if not path.exists():pytest.skip('Real diphthong artifact/fixture not installed')
    audio,rate=sf.read(path,dtype='float32');assert rate==16000
    base=da.analyze_diphthong(wav(audio),target)
    padded=da.analyze_diphthong(wav(np.pad(audio,(16000,112000-16000-len(audio)))),target)
    wrong=da.analyze_diphthong(wav(audio),'au' if target=='ai' else 'ai')
    quiet=da.analyze_diphthong(wav(audio*.01),target)
    assert base['scorable'] and base['phoneme_match']
    assert padded['scorable'] and quiet['scorable']
    assert base['actual_phonemes']==padded['actual_phonemes']==wrong['actual_phonemes']==quiet['actual_phonemes']
    assert base['active_duration_ms']==padded['active_duration_ms']
    assert not wrong['phoneme_match'] and wrong['accuracy']==0

@pytest.mark.parametrize('target',['ai','au'])
def test_shipped_human_diphthong_playback_matches_auxiliary(target):
    from pathlib import Path
    from app.services import diphthong_analysis as da
    path=Path(__file__).resolve().parents[2]/'frontend/public/assets/tamil-reference'/f'letter-{target}.wav'
    if not path.exists() or not (da.MODEL_DIR/'classifier.joblib').exists():
        pytest.skip('Human playback/model artifacts not installed')
    result=da.analyze_diphthong(path.read_bytes(),target)
    assert result['scorable'] and result['phoneme_match']
