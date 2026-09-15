"""Audio-derived IPA recognition and transparent, non-clinical edit accuracy.

No transcript, generated MFCC template or score floor is used for scoring.
The model's CTC vocabulary contains phones, not English spelling characters.
"""
from __future__ import annotations

import io
import logging
import math
import json
from pathlib import Path
import threading
from itertools import groupby

import numpy as np

logger = logging.getLogger(__name__)
MODEL_ID = 'facebook/wav2vec2-lv-60-espeak-cv-ft'
SAMPLE_RATE = 16000
MAX_SECONDS = 20
# Broad Tamil IPA targets. The model has no /mː/ token, so nasal length is
# not assessed; /amma/ uses broad /m/. Do not infer a length it cannot emit.
# These are explicit educational targets, not generated from recognized words.
TARGET_PHONES = {
    'a': ['a'], 'aa': ['aː'], 'i': ['i'], 'ii': ['iː'],
    'u': ['u'], 'uu': ['uː'], 'e': ['e'], 'ee': ['eː'],
    'ai': ['aɪ'], 'o': ['o'], 'oo': ['oː'], 'au': ['aʊ'],
    'amma': ['a', 'm', 'aː'], 'appa': ['a', 'pː', 'aː'],
    'maram': ['m', 'a', 'ɾ', 'a', 'm'], 'pazham': ['p', 'a', 'ɻ', 'a', 'm'],
    'naai': ['n', 'aː', 'j'], 'yaanai': ['j', 'aː', 'n', 'aɪ'],
    'la': ['l', 'a'], 'ta': ['t̪', 'a'],
    'kavi_vaa': ['k', 'a', 'ʋ', 'i', 'ʋ', 'aː'],
    # Broad, explicitly authored practice targets; dialectal/reduced variants
    # are not normalized. Final உ is represented broadly as /u/ here.
    # Intervocalic dental /ð/ and retroflex /ɖ/: Keane (2004), Tamil,
    # https://doi.org/10.1017/S0025100304001549 (phonetic variants, not a
    # universal pronunciation standard). Every token exists in the CTC vocab.
    'aadu': ['aː', 'ɖ', 'u'], 'ilai': ['i', 'l', 'aɪ'],
    'uppu': ['u', 'pː', 'u'], 'eli': ['e', 'l', 'i'],
    'amma_vaa': ['a', 'm', 'aː', 'ʋ', 'aː'],
    'appa_vaa': ['a', 'pː', 'aː', 'ʋ', 'aː'],
    'idhu_maram': ['i', 'ð', 'u', 'm', 'a', 'ɾ', 'a', 'm'],
    'idhu_pazham': ['i', 'ð', 'u', 'p', 'a', 'ɻ', 'a', 'm'],
    'appa_maram': ['a', 'pː', 'aː', 'm', 'a', 'ɾ', 'a', 't̪ː', 'aɪ', 'pː', 'aː', 'ɾ'],
    'amma_viitil_irukkiraar': ['a', 'm', 'aː', 'ʋ', 'iː', 'ʈ', 'i', 'l', 'i', 'ɾ', 'u', 'kː', 'i', 'ɾ', 'aː', 'ɾ'],
    'naai_oodugiradhu': ['n', 'aː', 'j', 'oː', 'ɖ', 'u', 'k', 'i', 'ɾ', 'a', 't̪', 'u'],
    'kavi_bridge': ['k', 'a', 'ʋ', 'i', 'p', 'aː', 'l', 'a', 't̪ː', 'aɪ', 'k', 'k', 'a', 'ɖ', 'a', 'kː', 'a', 'l', 'aː', 'm'],
}

# Full sentence targets may contain one phone substitution/deletion/insertion
# from the acoustic recognizer. Words and vowels stay exact so partial words,
# different words, and short/long substitutions are never accepted.
SENTENCE_TARGETS = {
    'amma_vaa', 'appa_vaa', 'kavi_vaa', 'idhu_maram', 'idhu_pazham',
    'appa_maram', 'amma_viitil_irukkiraar', 'naai_oodugiradhu', 'kavi_bridge',
}


def align_phones(expected: list[str], actual: list[str]) -> dict:
    """Unit-cost Levenshtein alignment; 100 * max(0, 1 - edits / targets)."""
    n, m = len(expected), len(actual)
    costs = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        costs[i][0] = i
    for j in range(m + 1):
        costs[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            costs[i][j] = min(costs[i - 1][j] + 1, costs[i][j - 1] + 1,
                              costs[i - 1][j - 1] + (expected[i - 1] != actual[j - 1]))
    rows = []
    i, j = n, m
    while i or j:
        if i and j and costs[i][j] == costs[i - 1][j - 1] + (expected[i - 1] != actual[j - 1]):
            rows.append({'expected': expected[i - 1], 'actual': actual[j - 1],
                         'operation': 'correct' if expected[i - 1] == actual[j - 1] else 'substitution'})
            i, j = i - 1, j - 1
        elif i and costs[i][j] == costs[i - 1][j] + 1:
            rows.append({'expected': expected[i - 1], 'actual': None, 'operation': 'deletion'})
            i -= 1
        else:
            rows.append({'expected': None, 'actual': actual[j - 1], 'operation': 'insertion'})
            j -= 1
    rows.reverse()
    return {
        'accuracy': round(100 * max(0, 1 - costs[n][m] / max(1, n)), 2),
        'phoneme_alignment': rows,
        'phoneme_errors': [row for row in rows if row['operation'] != 'correct'],
        'correct_phonemes': sum(row['operation'] == 'correct' for row in rows),
        'total_phonemes': n,
        'edit_distance': costs[n][m],
    }


def decode_audio(data: bytes) -> tuple[np.ndarray, dict]:
    """Decode a bounded clip, downmix and resample without pitch modification.

    SoundFile handles PCM WAV from the browser. PyAV is the codec fallback for
    Android M4A and browser WebM/Opus; no shell command or temporary file is used.
    """
    import soundfile as sf
    from scipy.signal import resample_poly

    if not data:
        raise ValueError('The recording is empty.')
    try:
        with sf.SoundFile(io.BytesIO(data)) as source:
            sr = source.samplerate
            if source.frames / sr > MAX_SECONDS:
                raise ValueError('Please record no more than 20 seconds.')
            audio = source.read(dtype='float32', always_2d=True).mean(axis=1)
    except (sf.LibsndfileError, RuntimeError):
        try:
            import av
            frames = []
            count = 0
            with av.open(io.BytesIO(data)) as container:
                resampler = av.AudioResampler(format='fltp', layout='mono', rate=SAMPLE_RATE)
                for frame in container.decode(audio=0):
                    for converted in resampler.resample(frame):
                        chunk = converted.to_ndarray().ravel()
                        count += len(chunk)
                        if count > MAX_SECONDS * SAMPLE_RATE:
                            raise ValueError('Please record no more than 20 seconds.')
                        frames.append(chunk)
                for converted in resampler.resample(None):
                    frames.append(converted.to_ndarray().ravel())
            audio = np.concatenate(frames) if frames else np.array([], dtype=np.float32)
            sr = SAMPLE_RATE
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError('This recording could not be decoded. Try recording again.') from exc
    if audio.size == 0 or not np.isfinite(audio).all():
        raise ValueError('The recording contains no valid audio samples.')
    if len(audio) / sr > MAX_SECONDS:
        raise ValueError('Please record no more than 20 seconds.')
    if sr != SAMPLE_RATE:
        divisor = math.gcd(sr, SAMPLE_RATE)
        audio = resample_poly(audio, SAMPLE_RATE // divisor, sr // divisor).astype(np.float32)
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio ** 2)))
    window = 320
    padded = np.pad(audio, (0, (-len(audio)) % window))
    energy = np.sqrt(np.mean(padded.reshape(-1, window) ** 2, axis=1))
    active = energy > max(.004, float(energy.max()) * .08)
    active_seconds = float(active.sum() * window / SAMPLE_RATE)
    active_rms = float(np.sqrt(np.mean(energy[active] ** 2))) if active.any() else 0.
    clipped = float(np.mean(np.abs(audio) >= .995))
    quality = {'duration_seconds': round(len(audio) / SAMPLE_RATE, 3),
               'active_duration_seconds': round(active_seconds, 3), 'rms': rms,
               'peak': peak, 'clipping_ratio': clipped,
               # Appending capture silence cannot erase detected speech energy.
               # Raw whole-container RMS above remains available for diagnostics.
               'has_speech': active_rms >= .004 and peak >= .01 and active_seconds >= .12,
               'warnings': ['The recording is clipped. Move slightly away from the microphone.'] if clipped > .02 else []}
    # Energy segmentation is a quality gate, not a claim of neural speech VAD.
    if active.any():
        indices = np.flatnonzero(active)
        start = max(0, (indices[0] - 5) * window)
        end = min(len(audio), (indices[-1] + 6) * window)
        audio = audio[start:end]
    return np.ascontiguousarray(audio, dtype=np.float32), quality


class AcousticPhoneRecognizer:
    def __init__(self):
        self._lock = threading.Lock()
        self.model = None
        self.processor = None
        self.status = 'not_loaded'

    def warm_up(self):
        try:
            self._load()
        except Exception:
            logger.exception('Acoustic phoneme model unavailable')

    def _load(self):
        with self._lock:
            if self.model is not None:
                return
            self.status = 'loading'
            try:
                import onnxruntime as ort
                from ..config import settings
                directory = Path(settings.PHONEME_ONNX_PATH)
                config = json.loads((directory / 'preprocessor_config.json').read_text(encoding='utf-8'))
                self.normalize = config.get('do_normalize', True)
                self.vocab = {value: key for key, value in json.loads((directory / 'vocab.json').read_text(encoding='utf-8')).items()}
                options = ort.SessionOptions()
                options.intra_op_num_threads = max(1, min(8, settings.PHONEME_CPU_THREADS))
                options.inter_op_num_threads = 1
                self.model = ort.InferenceSession(str(directory / 'model_quantized.onnx'),
                                                 sess_options=options, providers=['CPUExecutionProvider'])
                self.status = 'ready'
            except Exception:
                self.status = 'unavailable'
                raise

    def __call__(self, audio: np.ndarray) -> dict:
        self._load()
        # Serialize CPU inference to bound memory under concurrent submissions.
        with self._lock:
            samples = audio.astype(np.float32)
            if self.normalize:
                samples = (samples - samples.mean()) / np.sqrt(samples.var() + 1e-7)
            inputs = {'input_values': samples[None, :]}
            if any(item.name == 'attention_mask' for item in self.model.get_inputs()):
                inputs['attention_mask'] = np.ones((1, len(samples)), dtype=np.int64)
            logits = self.model.run(None, inputs)[0][0]
            exp = np.exp(logits - logits.max(axis=-1, keepdims=True))
            probs = exp / exp.sum(axis=-1, keepdims=True)
            ids = probs.argmax(axis=-1).tolist()
            phones, segments, confidence = [], [], []
            offset = 0
            seconds_per_frame = len(audio) / SAMPLE_RATE / max(len(ids), 1)
            for token_id, values in groupby(ids):
                length = sum(1 for _ in values)
                token = self.vocab.get(token_id, '<unk>')
                if token not in {'<pad>', '<s>', '</s>', '<unk>', '|', ' ', ''}:
                    probability = float(probs[offset:offset + length, token_id].mean())
                    phones.append(token)
                    confidence.append(probability)
                    segments.append({'phoneme': token, 'start_seconds': round(offset * seconds_per_frame, 3),
                                     'end_seconds': round((offset + length) * seconds_per_frame, 3),
                                     'confidence': round(probability, 4)})
                offset += length
            return {'phones': phones, 'segments': segments,
                    'confidence': float(np.mean(confidence)) if confidence else 0}


class PhonemeEvaluator:
    def __init__(self, recognizer=None):
        self.recognizer = recognizer if recognizer is not None else AcousticPhoneRecognizer()

    def warm_up(self):
        if hasattr(self.recognizer, 'warm_up'):
            self.recognizer.warm_up()

    def evaluate_pronunciation(self, audio_bytes, target_phoneme, browser_transcript=''):
        target = str(target_phoneme).strip().lower()
        result = {'accuracy': 0, 'phoneme_match': False, 'scorable': False,
                  'mfcc_score': None, 'gop_score': None, 'airflow_score': 0,
                  'syllable_scores': [], 'weakest_syllable': None,
                  'transcription': '', 'validation_source': 'none',
                  'expected_phonemes': TARGET_PHONES.get(target, []), 'actual_phonemes': [],
                  'phoneme_alignment': [], 'phoneme_errors': [], 'confidence': None,
                  'score_method': 'phoneme_edit_accuracy_v1'}
        if target not in TARGET_PHONES:
            return {**result, 'validation_status': 'invalid_target', 'feedback': 'This practice target is not supported.'}
        try:
            audio, quality = decode_audio(audio_bytes)
        except (ValueError, ImportError) as exc:
            return {**result, 'validation_status': 'invalid_audio', 'feedback': str(exc)}
        result.update(audio_quality=quality, active_duration_ms=round(quality['active_duration_seconds'] * 1000))
        if not quality['has_speech']:
            return {**result, 'validation_status': 'no_speech',
                    'feedback': 'I could not hear a clear voice. Move closer and try again.'}
        try:
            recognized = self.recognizer(audio)
        except Exception:
            logger.exception('Phoneme inference failed')
            return {**result, 'validation_status': 'recognizer_unavailable',
                    'feedback': 'The speech model is unavailable. Please retry after it has loaded.'}
        actual = recognized['phones']
        if not actual:
            return {**result, 'validation_status': 'no_phonemes',
                    'feedback': 'No stable speech sounds were detected. Please try again.'}
        alignment = align_phones(TARGET_PHONES[target], actual)
        errors = alignment['phoneme_errors']
        matched = alignment['edit_distance'] <= (1 if target in SENTENCE_TARGETS else 0)
        feedback = ('The detected sounds match the complete target. Well done!' if not errors else
                    'The complete sentence matched with one minor sound variation.' if matched else
                    'Good effort! Listen to the example and try again.')
        if errors and not matched:
            first = errors[0]
            if first['operation'] == 'substitution':
                feedback = f"Try /{first['expected']}/ again. The model heard /{first['actual']}/."
            elif first['operation'] == 'deletion':
                feedback = f"Try including the /{first['expected']}/ sound."
            else:
                feedback = f"Try the target again without the extra /{first['actual']}/ sound."
        return {**result, **alignment, 'scorable': True, 'phoneme_match': matched,
                'actual_phonemes': actual, 'phoneme_segments': recognized.get('segments', []),
                'confidence': round(recognized['confidence'], 4),
                'validation_status': 'validated' if not errors else 'validated_with_variation' if matched else 'not_matched',
                'validation_source': 'acoustic_phoneme_model', 'feedback': feedback,
                'model_id': MODEL_ID}


phoneme_evaluator = PhonemeEvaluator()


class AcousticStoryEvaluator:
    """Adapt acoustic results to the existing five-page story contract."""
    def evaluate(self, audio_bytes: bytes, target_id: str) -> dict:
        result = phoneme_evaluator.evaluate_pronunciation(audio_bytes, target_id)
        available = result['scorable']
        accuracy = result['accuracy'] if available else None
        return {**result, 'accuracy': accuracy, 'matched': result['phoneme_match'] if available else None,
                'method': 'acoustic_phoneme_model', 'transcript': '',
                'feedback_key': ('wonderful' if accuracy >= 88 else 'almost' if accuracy >= 62 else 'try_together') if available else 'model_unavailable',
                'capability': 'available' if available else 'model_unavailable'}
