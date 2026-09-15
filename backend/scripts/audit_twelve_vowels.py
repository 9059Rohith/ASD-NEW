"""Read-only model audit; fixed test-speaker sampling, no fitting/threshold tuning.

Run from backend: .runtime/Scripts/python.exe scripts/audit_twelve_vowels.py
Writes only .runlogs/twelve-vowel-audit.json. Synthetic stress is separate.
"""
import os
os.environ.setdefault('USE_TF', '0')
# Load ORT before scipy/sklearn on this Windows runtime to avoid DLL init clash.
import onnxruntime
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import io
import json
import math
from collections import Counter
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from vowel_train import SOURCE, BASE, SOURCE_LABELS, process_file, split_recording
from app.services.vowel_analysis import analyze_vowel, TARGETS
from app.services.phoneme_pipeline import phoneme_evaluator

OUTPUT = BASE.parents[2] / '.runlogs/twelve-vowel-audit.json'
LABELS = dict(SOURCE_LABELS, i='ai', av='au')

def encode(audio):
    buff = io.BytesIO()
    sf.write(buff, audio, 16000, format='WAV', subtype='FLOAT')
    return buff.getvalue()

def evaluate(audio, target):
    data = encode(audio)
    if target in TARGETS:
        value = analyze_vowel(data, target)
        pred = value['vowel_analysis']
        return dict(scorable=value['scorable'], status=value['validation_status'],
                    prediction=[pred['identity'], pred['length']],
                    correct=pred['identity_match'] and pred['length_match'],
                    confidence=pred['confidence'], duration=pred['duration_seconds'])
    value = phoneme_evaluator.evaluate_pronunciation(data, target)
    return dict(scorable=value['scorable'], status=value['validation_status'],
                prediction=value['actual_phonemes'], correct=value['phoneme_match'],
                confidence=value['confidence'], duration=value.get('active_duration_ms', 0)/1000)

def summarize(rows):
    accepted = [r for r in rows if r['scorable']]
    return dict(n=len(rows), accepted=len(accepted), coverage=len(accepted)/len(rows),
                accepted_correct=sum(r['correct'] for r in accepted),
                accepted_accuracy=sum(r['correct'] for r in accepted)/len(accepted) if accepted else None,
                statuses=dict(Counter(r['status'] for r in rows)))

def main():
    phoneme_evaluator.warm_up()
    if phoneme_evaluator.recognizer.status != 'ready':
        raise RuntimeError('Real phoneme model must load before benchmarking.')
    report = json.loads((BASE/'evaluation.json').read_text())
    speakers = set(report['speaker_splits']['test'])
    rng = np.random.default_rng(6092027)
    human, stress, matrix = [], [], []
    exemplars = {}
    for path in sorted(SOURCE.glob('*/*.wav')):
        target = LABELS.get(path.parent.name)
        speaker = path.stem.split('T')[0]
        if target is None or speaker not in speakers:
            continue
        samples, rate = sf.read(path, dtype='float32')
        if samples.ndim > 1:
            samples = samples.mean(axis=1)
        if rate != 16000:
            divisor = math.gcd(rate, 16000)
            samples = resample_poly(samples, 16000//divisor, rate//divisor)
        if target in TARGETS:
            records, _ = process_file(path)
        else:
            records = [dict(start=start, end=end) for start, end in split_recording(samples)]
        # Diphthongs are energy-segmented only; never filter by recognizer result.
        for index in rng.choice(len(records), min(5, len(records)), replace=False):
            seg = records[int(index)]
            audio = samples[seg['start']:seg['end']]
            base = evaluate(audio, target)
            padded = np.pad(audio, (16000, max(0, 112000-16000-len(audio))))
            pad = evaluate(padded, target)
            row = dict(target=target, speaker=speaker, source=str(path.relative_to(SOURCE)),
                       segment_index=int(index), start=int(seg['start']), end=int(seg['end']), **base,
                       padding_prediction_agreement=base['prediction']==pad['prediction'],
                       padding_scorable=pad['scorable'], padding_status=pad['status'],
                       padding_duration_difference=abs(base['duration']-pad['duration']) if base['duration'] is not None and pad['duration'] is not None else None)
            human.append(row)
            if target not in exemplars:
                exemplars[target] = audio
        audio = samples[records[len(records)//2]['start']:records[len(records)//2]['end']]
        noise = rng.normal(0, np.sqrt(np.mean(audio**2))/np.sqrt(10**.5), len(audio))
        for kind, altered in [('quiet_minus40dB', audio*.01), ('5dB_white_noise', audio+noise),
                              ('multiple_vowels', np.r_[audio, np.zeros(8000), audio])]:
            stress.append(dict(target=target, speaker=speaker, kind=kind, **evaluate(altered, target)))
        print(f'{target} {speaker}: {len(human)} human cases complete', flush=True)
        OUTPUT.write_text(json.dumps(dict(human_rows=human, stress_rows=stress), indent=2), encoding='utf8')
    for actual, audio in exemplars.items():
        # Full cross-target matrix within each engine plus monophthong inputs to ai/au.
        for target in LABELS.values():
            result = evaluate(audio, target)
            matrix.append(dict(source_target=actual, requested_target=target, **result))
    for target in LABELS.values():
        for kind, audio in [('silence', np.zeros(112000)), ('white_noise', rng.normal(0,.03,16000)),
                            ('very_short', rng.normal(0,.03,320))]:
            stress.append(dict(target=target, kind=kind, **evaluate(audio,target)))
    output = dict(model_version=report['model_version'], seed=6092027, speaker_splits=report['speaker_splits'],
                  selection='Five random candidate segments per test speaker/category. Monophthongs use existing quality-accepted feature shards; ai/au use energy segmentation without recognition filtering. FLOAT WAV. No training.',
                  per_class={t:summarize([r for r in human if r['target']==t]) for t in LABELS.values()},
                  per_engine={engine:summarize([r for r in human if (r['target'] in TARGETS)==paired]) for engine,paired in [('paired',True),('diphthong_phoneme',False)]},
                  stress_summary={k:summarize([r for r in stress if r['kind']==k]) for k in sorted({r['kind'] for r in stress})},
                  padding_summary={label:dict(n=len(rows := [r for r in human if (r['target'] in ('ai','au'))==dip]),
                      preserved_predictions=sum(r['padding_prediction_agreement'] for r in rows),
                      original_scorable=sum(r['scorable'] for r in rows), padded_scorable=sum(r['padding_scorable'] for r in rows))
                      for label,dip in [('paired',False),('diphthong',True)]},
                  prompt_independence={f'{s}_{engine}':len({tuple(r['prediction']) for r in matrix
                      if r['source_target']==s and (r['requested_target'] in ('ai','au'))==dip})==1
                      for s in LABELS.values() for engine,dip in [('paired',False),('phoneme',True)]},
                  human_rows=human, stress_rows=stress, cross_target_matrix=matrix)
    OUTPUT.write_text(json.dumps(output, indent=2), encoding='utf8')
    print(json.dumps({k:v for k,v in output.items() if not k.endswith('rows') and k!='cross_target_matrix'},indent=2))

if __name__ == '__main__':
    main()
