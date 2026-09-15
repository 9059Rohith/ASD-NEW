"""Reproducible real recording segmentation, speaker-disjoint training/evaluation.

Run with backend as current directory: .runtime/Scripts/python.exe scripts/vowel_train.py
Input archive extraction: models/vowel-classifier/data/Tamil Alphabets.
"""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
os.environ.setdefault('OMP_NUM_THREADS', '2')
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json
import hashlib
import time
import math
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import joblib
import numpy as np
import soundfile as sf
import sklearn
import scipy
from scipy.ndimage import binary_closing
from scipy.signal import resample_poly
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

from app.services.vowel_analysis import extract_features, TARGETS

BASE = Path(__file__).resolve().parents[1] / 'models/vowel-classifier'
SOURCE = BASE / 'data/Tamil Alphabets'
VERSION = 'tamil-mendeley-v1.1-2026-09-06'
# Corpus uses English sound spellings: e/ee = Tamil i/i:, eh/ehh = e/e:.
# The sole folder i is the /ai/ diphthong. It is not a short /i/ category.
SOURCE_LABELS = {'a': 'a', 'aa': 'aa', 'e': 'i', 'ee': 'ii', 'eh': 'e',
                 'ehh': 'ee', 'o': 'o', 'oo': 'oo', 'u': 'u', 'uu': 'uu'}


def split_recording(samples):
    """Find candidate repetitions in continuous source WAVs; never cut by label length."""
    samples = samples - samples.mean()
    frames = np.lib.stride_tricks.sliding_window_view(samples, 320)[::160]
    energy = np.sqrt(np.mean(frames ** 2, axis=1))
    threshold = max(.0015, np.percentile(energy, 95) * .12, np.percentile(energy, 10) * 2)
    active = binary_closing(np.pad(energy > threshold, (4, 4)), structure=np.ones(6))[4:-4]
    changes = np.diff(np.r_[False, active, False].astype(int))
    for start, end in zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)):
        if end - start >= 6:
            yield max(0, start * 160 - 640), min(len(samples), end * 160 + 960)


def process_file(path):
    source_label = path.parent.name.lower()
    target = SOURCE_LABELS.get(source_label)
    if target is None:
        return [], {'path': str(path.relative_to(SOURCE)), 'excluded_label': source_label}
    cache_dir = BASE / 'data/feature-shards'
    cache_dir.mkdir(exist_ok=True)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    shard = cache_dir / f'{digest}.joblib'
    if shard.exists():
        rows, report = joblib.load(shard)
        for row in rows:
            row.update(target=target, identity=TARGETS[target][0], length=TARGETS[target][1])
        report.update(target=target, source_label=source_label, source_sample_rate=sf.info(path).samplerate, source_sha256=digest)
        return rows, report
    samples, rate = sf.read(path, dtype='float32')
    if len(samples) != sf.info(path).frames:
        return [], {'path': str(path.relative_to(SOURCE)), 'excluded': 'incomplete_file'}
    source_rate = rate
    if samples.ndim == 2:
        samples = samples.mean(axis=1)
    if rate != 16000:
        divisor = math.gcd(rate, 16000)
        samples = resample_poly(samples, 16000 // divisor, rate // divisor)
        rate = 16000
    speaker = path.stem.split('T')[0]
    records, statuses = [], Counter()
    for index, (start, end) in enumerate(split_recording(samples)):
        f = extract_features(samples[start:end])
        statuses[f['status']] += 1
        if f['status'] != 'ok':
            continue
        records.append({'path': str(path.relative_to(SOURCE)), 'speaker': speaker, 'target': target,
                        'identity': TARGETS[target][0], 'length': TARGETS[target][1],
                        'start': start, 'end': end, 'index': index, 'features': f['identity_features'],
                        'duration': f['duration_seconds'], 'periodicity': f['periodicity'],
                        'stability': f['stability']})
    output = records, {'path': str(path.relative_to(SOURCE)), 'speaker': speaker, 'target': target, 'source_label': source_label,
                     'source_seconds': len(samples) / rate, 'source_sample_rate': source_rate,
                     'source_sha256': digest, 'segments': dict(statuses)}
    joblib.dump(output, shard)
    return output


def metrics(actual, predicted, labels):
    return {'accuracy': float(accuracy_score(actual, predicted)),
            'classification_report': classification_report(actual, predicted, labels=labels, output_dict=True, zero_division=0),
            'labels': list(labels), 'confusion_matrix': confusion_matrix(actual, predicted, labels=labels).tolist()}


def main():
    BASE.mkdir(parents=True, exist_ok=True)
    # The archive ALSO contains pre-existing train/test copies of recordings.
    # Use each original top-level label recording exactly once and split speakers
    # ourselves; recursively ingesting those copies would duplicate examples.
    files = sorted(SOURCE.glob('*/*.wav'))
    fingerprint = hashlib.sha256((str(SOURCE_LABELS) + str([
        (str(p.relative_to(SOURCE)), hashlib.sha256(p.read_bytes()).hexdigest()) for p in files
    ])).encode()).hexdigest()
    cache = BASE / f'data/features-{fingerprint}.joblib'
    if cache.exists():
        records, inventory = joblib.load(cache)
    else:
        records, inventory = [], []
        print('Source files', len(files), flush=True)
        with ThreadPoolExecutor(max_workers=4) as pool:
            for rows, report in pool.map(process_file, files):
                records.extend(rows); inventory.append(report)
                print(report, flush=True)
        joblib.dump((records, inventory), cache)
    speakers = sorted({r['speaker'] for r in records})
    assert len(speakers) == 20, speakers
    rng = np.random.default_rng(260906)
    split = {'train': [], 'validation': [], 'test': []}
    for gender in ('F', 'M'):
        selected = [s for s in speakers if s.startswith(gender)]
        rng.shuffle(selected)
        split['train'].extend(selected[:6]); split['validation'].extend(selected[6:8]); split['test'].extend(selected[8:])
    masks = {name: np.array([r['speaker'] in people for r in records]) for name, people in split.items()}
    x = np.array([r['features'] for r in records]); yi = np.array([r['identity'] for r in records])
    yl = np.array([r['length'] for r in records]); duration = np.log(np.array([r['duration'] for r in records]))[:, None]
    train, val, test = (masks[k] for k in ('train', 'validation', 'test'))
    for key, mask in masks.items():
        assert len(set(r['target'] for r,m in zip(records,mask) if m)) == 10, key
    candidates = {'extra_trees': ExtraTreesClassifier(n_estimators=400, min_samples_leaf=3, n_jobs=4, random_state=260906),
                  'svm': make_pipeline(StandardScaler(), SVC(C=10, gamma='scale', cache_size=512))}
    candidate_metrics = {}
    best, best_score = None, -1
    for name, estimator in candidates.items():
        t = time.time(); estimator.fit(x[train], yi[train]); pred = estimator.predict(x[val]); score = accuracy_score(yi[val], pred)
        candidate_metrics[name] = float(score)
        print('CANDIDATE', name, score, 'seconds', time.time()-t, flush=True)
        if score > best_score: best, best_score = estimator, score
    identity = CalibratedClassifierCV(best, method='sigmoid', cv='prefit')
    identity.fit(x[val], yi[val])
    length_models = {}
    for vowel in sorted(set(yi)):
        subset = train & (yi == vowel)
        classifier = make_pipeline(StandardScaler(), LogisticRegression(C=1, random_state=260906))
        classifier.fit(duration[subset], yl[subset]); length_models[vowel] = classifier
    thresholds = {'identity_threshold': .60, 'length_threshold': .60}
    learned_boundaries = {}
    for vowel, pipeline in length_models.items():
        scaler, logistic = pipeline.steps[0][1], pipeline.steps[1][1]
        def duration_at_probability(probability):
            z = (np.log(probability / (1 - probability)) - logistic.intercept_[0]) / logistic.coef_[0, 0]
            return float(np.exp(z * scaler.scale_[0] + scaler.mean_[0]))
        learned_boundaries[vowel] = {'equal_probability_seconds': duration_at_probability(.5),
                                    'ambiguous_duration_interval_seconds': sorted([duration_at_probability(.4), duration_at_probability(.6)])}
    evaluation = {'model_version': VERSION, 'source': 'https://doi.org/10.17632/2dnxmvm22k.1',
                  'license': 'CC BY 4.0', 'split_seed': 260906, 'speaker_splits': split,
                  'source_label_mapping': SOURCE_LABELS,
                  'software_versions': {'numpy': np.__version__, 'scipy': scipy.__version__, 'scikit_learn': sklearn.__version__, 'joblib': joblib.__version__},
                  'candidate_validation_identity_accuracy': candidate_metrics, 'inventory': inventory,
                  'counts': {k: int(v.sum()) for k,v in masks.items()}, 'thresholds': thresholds,
                  'length_features': ['log(actual_voiced_duration_seconds)'],
                  'learned_length_boundaries': learned_boundaries,
                  'identity_features': '80 MFCC statistics, coefficients 1..20, excluding duration and energy',
                  'calibration': 'sigmoid calibration fitted on validation speakers; test speakers untouched'}
    for name, mask in masks.items():
        probs = identity.predict_proba(x[mask]); pred_i = identity.classes_[probs.argmax(axis=1)]
        pred_l, conf_l = [], []
        for vowel, d in zip(pred_i, duration[mask]):
            p = length_models[vowel].predict_proba(d[None, :])[0]
            pred_l.append(length_models[vowel].classes_[p.argmax()]); conf_l.append(p.max())
        pred_l = np.array(pred_l); accepted = (probs.max(axis=1) >= thresholds['identity_threshold']) & (np.array(conf_l) >= thresholds['length_threshold'])
        actual_joint = np.char.add(np.char.add(yi[mask], '_'), yl[mask]); predicted_joint = np.char.add(np.char.add(pred_i, '_'), pred_l)
        evaluation[name] = {'identity': metrics(yi[mask], pred_i, sorted(set(yi))),
                            'length': metrics(yl[mask], pred_l, ['short', 'long']),
                            'combined': metrics(actual_joint, predicted_joint, sorted(set(actual_joint))),
                            'confidence_gate_coverage': float(accepted.mean()),
                            'accepted_combined_accuracy': float(np.mean(actual_joint[accepted] == predicted_joint[accepted])) if accepted.any() else None}
        print(name, 'identity', evaluation[name]['identity']['accuracy'], 'length', evaluation[name]['length']['accuracy'],
              'combined', evaluation[name]['combined']['accuracy'], 'coverage', accepted.mean(), flush=True)
    summary = {k: evaluation['test'][k]['accuracy'] for k in ('identity', 'length', 'combined')}
    artifact = {'schema_version': 1, 'model_version': VERSION, 'identity': identity, 'length': length_models,
                'evaluation_summary': summary, **thresholds}
    joblib.dump(artifact, BASE / 'classifier.next.joblib', compress=3)
    (BASE / 'classifier.next.joblib').replace(BASE / 'classifier.joblib')
    evaluation['artifact_sha256'] = hashlib.sha256((BASE / 'classifier.joblib').read_bytes()).hexdigest()
    (BASE / 'evaluation.json').write_text(json.dumps(evaluation, indent=2), encoding='utf8')
    manifests = {'references': {}, 'heldout': {}}
    for group, allowed in [('references', train), ('heldout', test)]:
        folder = BASE / group; folder.mkdir(exist_ok=True)
        for target in TARGETS:
            eligible = [r for r, ok in zip(records, allowed) if ok and r['target'] == target]
            # Choose a representative duration and stable voicing, within split only.
            median = np.median([r['duration'] for r in eligible])
            eligible.sort(key=lambda r: abs(np.log(r['duration']/median)) + .1 * r['stability'])
            selected = None
            for row in eligible:
                p = identity.predict_proba(row['features'][None, :])[0]
                lp = length_models[row['identity']].predict_proba([[np.log(row['duration'])]])[0]
                l = length_models[row['identity']].classes_[lp.argmax()]
                if identity.classes_[p.argmax()] == row['identity'] and l == row['length'] and min(p.max(), lp.max()) >= .70:
                    selected = row
                    break
            if selected is None:
                raise RuntimeError(f'No confident representative for {group}/{target}; do not fabricate one.')
            row = selected
            samples, rate = sf.read(SOURCE / row['path'], dtype='float32')
            if samples.ndim == 2:
                samples = samples.mean(axis=1)
            if rate != 16000:
                divisor = math.gcd(rate, 16000)
                samples = resample_poly(samples, 16000 // divisor, rate // divisor)
                rate = 16000
            sf.write(folder / f'{target}.wav', samples[row['start']:row['end']], rate, subtype='PCM_16')
            manifests[group][target] = {'path': f'{group}/{target}.wav', 'speaker': row['speaker'],
                'source_file': row['path'], 'source_start_sample': int(row['start']), 'source_end_sample': int(row['end']),
                'boundary_sample_rate': 16000, 'source_start_seconds': row['start'] / 16000,
                'source_end_seconds': row['end'] / 16000,
                'source_original_sample_rate': sf.info(SOURCE / row['path']).samplerate,
                'duration_seconds': row['duration'], 'license': 'CC BY 4.0',
                'attribution': 'Revathi Arunachalam, Vijayakrishnan VK, Nandhakumar N, Akilan A (2025), Tamil vowels-speech database, DOI 10.17632/2dnxmvm22k.1',
                'modifications': 'One repetition segmented from the continuous source recording; resampled to 16 kHz if needed; PCM16 WAV.'}
        (BASE / f'{group}.json').write_text(json.dumps(manifests[group], indent=2), encoding='utf8')
    from vowel_calibrate_quality import calibrate
    calibrate()


if __name__ == '__main__':
    main()
