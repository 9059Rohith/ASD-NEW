"""Exercise complete runtime on a fixed, independent sample of test-speaker clips.

No fitting or threshold adjustment is performed here. Corrupted signals test
abstention behavior only; they are never included in human recognition metrics.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import io
import json
from collections import Counter

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
import math

from app.services.vowel_analysis import analyze_vowel
from vowel_train import process_file, SOURCE, BASE, SOURCE_LABELS


def encode(samples):
    data = io.BytesIO()
    sf.write(data, samples, 16000, format='WAV', subtype='PCM_16')
    return data.getvalue()


def main():
    report = json.loads((BASE / 'evaluation.json').read_text())
    test_speakers = set(report['speaker_splits']['test'])
    rng = np.random.default_rng(6092026)
    stress_only = '--stress-only' in sys.argv
    rows = json.loads((BASE / 'runtime-evaluation.json').read_text())['human_rows'] if stress_only else []
    stress = []
    for path in sorted(SOURCE.glob('*/*.wav')):
        if path.parent.name not in SOURCE_LABELS or path.stem.split('T')[0] not in test_speakers:
            continue
        records, _ = process_file(path)
        samples, rate = sf.read(path, dtype='float32')
        if samples.ndim == 2:
            samples = samples.mean(axis=1)
        if rate != 16000:
            divisor = math.gcd(rate, 16000)
            samples = resample_poly(samples, 16000 // divisor, rate // divisor)
        for index in rng.choice(len(records), min(5, len(records)), replace=False):
            if stress_only:
                continue
            row = records[index]
            audio = samples[row['start']:row['end']]
            base = analyze_vowel(encode(audio), row['target'])
            padded = np.pad(audio, (16000, 112000 - 16000 - len(audio)))
            after = analyze_vowel(encode(padded), row['target'])
            predicted = base['vowel_analysis']
            rows.append({'speaker': row['speaker'], 'source_file': row['path'], 'source_segment_index': int(index),
                         'target': row['target'], 'scorable': base['scorable'], 'status': base['validation_status'],
                         'identity': predicted['identity'], 'length': predicted['length'],
                         'identity_correct': predicted['identity_match'], 'length_correct': predicted['length_match'],
                         'combined_correct': predicted['identity_match'] and predicted['length_match'],
                         'duration_seconds': predicted['duration_seconds'],
                         'padding_preserves_prediction': all(predicted[key] == after['vowel_analysis'][key] for key in ('identity', 'length')),
                         'padding_duration_difference': abs(predicted['duration_seconds'] - after['vowel_analysis']['duration_seconds'])})
        row = records[len(records) // 2]
        audio = samples[row['start']:row['end']]
        duplicate = np.r_[audio, np.zeros(8000), audio]
        clipped = np.clip(audio / max(np.max(np.abs(audio)), 1e-7) * 6, -1, 1)
        noise = rng.normal(0, np.sqrt(np.mean(audio ** 2)) / np.sqrt(10 ** (5 / 10)), len(audio))
        for kind, altered in [('multiple_vowels', duplicate), ('clipped_audio', clipped), ('5dB_white_noise', audio + noise)]:
            result = analyze_vowel(encode(altered), row['target'])
            stress.append({'kind': kind, 'speaker': row['speaker'], 'target': row['target'],
                           'status': result['validation_status'], 'scorable': result['scorable'],
                           'combined_correct': result['vowel_analysis']['identity_match'] and result['vowel_analysis']['length_match']})
    accepted = [r for r in rows if r['scorable']]
    summary = {'human_test_segments': len(rows), 'accepted': len(accepted),
               'coverage': len(accepted) / len(rows),
               'all_segment_combined_accuracy': sum(r['combined_correct'] for r in rows) / len(rows),
               'accepted_combined_accuracy': sum(r['combined_correct'] for r in accepted) / len(accepted) if accepted else None,
               'padding_prediction_agreement': sum(r['padding_preserves_prediction'] for r in rows) / len(rows),
               'maximum_padding_duration_difference_seconds': max(r['padding_duration_difference'] for r in rows),
               'statuses': dict(Counter(r['status'] for r in rows)),
               'stress': {kind: {'count': sum(r['kind'] == kind for r in stress),
                                 'abstentions': sum(r['kind'] == kind and not r['scorable'] for r in stress),
                                 'accepted_correct': sum(r['kind'] == kind and r['scorable'] and r['combined_correct'] for r in stress),
                                 'statuses': dict(Counter(r['status'] for r in stress if r['kind'] == kind))}
                          for kind in sorted({r['kind'] for r in stress})}}
    output = {'model_version': report['model_version'], 'sampling_seed': 6092026,
              'selection': 'Five random accepted source segments per original test-speaker/target recording, before runtime decisions.',
              'summary': summary, 'human_rows': rows, 'corruption_rows': stress}
    # Alternate output supports before/after audits without replacing baseline.
    destination = Path(sys.argv[sys.argv.index('--output') + 1]) if '--output' in sys.argv else BASE / 'runtime-evaluation.json'
    destination.write_text(json.dumps(output, indent=2), encoding='utf8')
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == '__main__':
    main()
