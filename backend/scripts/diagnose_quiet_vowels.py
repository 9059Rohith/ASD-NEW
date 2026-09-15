"""Compare real reference/held-out vowels at original, -20 dB and -40 dB gain.

This measures gain robustness on selected existing clips, not population accuracy.
Usage: python scripts/diagnose_quiet_vowels.py --output ../.runlogs/quiet-vowels-before.json
"""
import argparse
from collections import Counter
import io
import json
from pathlib import Path
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.vowel_analysis import MODEL_DIR, TARGETS, analyze_vowel


def wav(samples, subtype='PCM_16'):
    output = io.BytesIO()
    sf.write(output, samples, 16000, format='WAV', subtype=subtype)
    return output.getvalue()


def measure(subtype='PCM_16'):
    rows = []
    for group in ('references', 'heldout'):
        for target in TARGETS:
            samples, rate = sf.read(MODEL_DIR / group / f'{target}.wav', dtype='float32')
            assert rate == 16000
            for db in (0, -20, -40):
                result = analyze_vowel(wav(samples * 10 ** (db / 20), subtype), target)
                evidence = result['vowel_analysis']
                rows.append({'group': group, 'target': target, 'gain_db': db,
                             'status': result['validation_status'], 'scorable': result['scorable'],
                             'identity': evidence['identity'], 'length': evidence['length'],
                             'duration_seconds': evidence['duration_seconds'],
                             'identity_confidence': evidence['identity_confidence'],
                             'length_confidence': evidence['length_confidence'],
                             'accuracy': result['accuracy'], 'audio_quality': result.get('audio_quality')})
    corruptions = []
    samples, _ = sf.read(MODEL_DIR / 'heldout/i.wav', dtype='float32')
    rng = np.random.default_rng(7)
    noise = rng.normal(0, np.sqrt(np.mean(samples ** 2)) / np.sqrt(10 ** .5), len(samples))
    for db in (0, -20, -40):
        for name, signal in [('white_noise', rng.normal(0, .08, 16000)),
                             ('masked_vowel_5db_snr', samples + noise),
                             ('multiple_vowels', np.r_[samples, np.zeros(8000), samples])]:
            result = analyze_vowel(wav(signal * 10 ** (db / 20), subtype), 'i')
            corruptions.append({'case': name, 'gain_db': db, 'status': result['validation_status'], 'scorable': result['scorable']})
    for name, signal in [('silence', np.zeros(112000)), ('clipped_vowel', np.clip(samples * 100, -1, 1))]:
        result = analyze_vowel(wav(signal, subtype), 'i')
        corruptions.append({'case': name, 'status': result['validation_status'], 'scorable': result['scorable']})
    summary = {str(db): {'scorable': sum(r['scorable'] for r in rows if r['gain_db'] == db),
                         'total': 20, 'statuses': dict(Counter(r['status'] for r in rows if r['gain_db'] == db))}
               for db in (0, -20, -40)}
    baseline = {(row['group'], row['target']): row for row in rows if row['gain_db'] == 0}
    for db in (-20, -40):
        compared = [row for row in rows if row['gain_db'] == db]
        accepted = [row for row in compared if row['scorable']]
        def changed(row):
            original = baseline[row['group'], row['target']]
            return (row['identity'], row['length']) != (original['identity'], original['length'])
        deltas = [abs(row['duration_seconds'] - baseline[row['group'], row['target']]['duration_seconds'])
                  for row in compared if row['duration_seconds'] is not None]
        summary[str(db)].update(
            accepted_identity_or_length_changes=sum(changed(row) for row in accepted),
            nonnull_identity_or_length_changes=sum(changed(row) for row in compared if row['identity'] is not None),
            maximum_measured_duration_change_seconds=round(max(deltas, default=0), 4),
            gain_rescue_attempts=sum(row['audio_quality'].get('analysis_gain', 1) > 1 for row in compared))
    return {'scope': '20 selected existing human clips; gain robustness, not independent population accuracy', 'wav_subtype': subtype,
            'limitation': 'Original detectable clips retain established segmentation. Partially detected quiet input can remain ambiguous, have shortened duration, or hide repeats; gain invariance is not claimed.',
            'summary': summary, 'corruptions': corruptions, 'results': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--subtype', choices=['PCM_16', 'FLOAT'], default='PCM_16')
    args = parser.parse_args()
    report = measure(args.subtype)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'summary': report['summary'], 'corruptions': report['corruptions']}, indent=2))
