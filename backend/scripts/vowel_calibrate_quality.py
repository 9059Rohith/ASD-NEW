"""Learn the noise gate from training speakers, without changing classifier heads."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import hashlib
import json
import math

import joblib
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from app.services.vowel_analysis import extract_features
from vowel_train import BASE, SOURCE, SOURCE_LABELS, VERSION, process_file


def calibrate():
    report = json.loads((BASE / 'evaluation.json').read_text())
    training_speakers = set(report['speaker_splits']['train'])
    calibration = []
    for path in sorted(SOURCE.glob('*/*.wav')):
        if path.parent.name not in SOURCE_LABELS or path.stem.split('T')[0] not in training_speakers:
            continue
        records, _ = process_file(path)
        samples, rate = sf.read(path, dtype='float32')
        if samples.ndim == 2:
            samples = samples.mean(axis=1)
        if rate != 16000:
            divisor = math.gcd(rate, 16000)
            samples = resample_poly(samples, 16000 // divisor, rate // divisor)
        for index in np.linspace(0, len(records) - 1, 5, dtype=int):
            row = records[index]
            features = extract_features(samples[row['start']:row['end']])
            calibration.append({'speaker': row['speaker'], 'target': row['target'],
                                'source_file': row['path'], 'source_segment_index': int(index),
                                'spectral_flatness': features['spectral_flatness']})
    limit = float(np.quantile([row['spectral_flatness'] for row in calibration], .995))
    artifact = joblib.load(BASE / 'classifier.joblib')
    artifact.update(spectral_flatness_limit=limit, model_version=VERSION)
    joblib.dump(artifact, BASE / 'classifier.next.joblib', compress=3)
    (BASE / 'classifier.next.joblib').replace(BASE / 'classifier.joblib')
    report.update(model_version=VERSION, artifact_sha256=hashlib.sha256((BASE / 'classifier.joblib').read_bytes()).hexdigest(),
                  noise_gate={'feature': 'median voiced-frame spectral flatness, excluding first four FFT bins',
                              'threshold': limit, 'training_quantile': .995, 'training_segments': len(calibration),
                              'selection': 'Five evenly spaced segments from each training-speaker/target original recording; no validation or test samples.',
                              'note': 'Added after a synthetic noise stress test exposed confident errors. Classifier weights are unchanged; runtime evaluation is rerun.'})
    (BASE / 'evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    (BASE / 'quality-calibration.json').write_text(json.dumps(calibration, indent=2), encoding='utf8')
    print('Training-derived spectral flatness limit', limit, 'from', len(calibration), 'human segments', flush=True)


if __name__ == '__main__':
    calibrate()
