"""Diagnostic train-only threshold selection with untouched validation speakers.

No application/model writes. This small diagnostic cannot establish calibration.
"""
import os
os.environ.setdefault('USE_TF', '0')
import onnxruntime
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json
import math
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from vowel_train import SOURCE, BASE, SOURCE_LABELS, split_recording
from app.services.phoneme_pipeline import phoneme_evaluator, TARGET_PHONES
from audit_twelve_vowels import encode

def main():
    splits = json.loads((BASE/'evaluation.json').read_text())['speaker_splits']
    rng = np.random.default_rng(6092028)
    rows = []
    for path in sorted(SOURCE.glob('*/*.wav')):
        speaker = path.stem.split('T')[0]
        split = next((k for k in ('train','validation') if speaker in splits[k]), None)
        target = dict(SOURCE_LABELS,i='ai',av='au').get(path.parent.name)
        if split is None or target is None:
            continue
        samples,rate=sf.read(path,dtype='float32')
        if samples.ndim>1: samples=samples.mean(axis=1)
        if rate != 16000:
            d=math.gcd(rate,16000); samples=resample_poly(samples,16000//d,rate//d)
        segments=list(split_recording(samples))
        idx=int(rng.integers(len(segments))); start,end=segments[idx]
        result=phoneme_evaluator.evaluate_pronunciation(encode(samples[start:end]),'ai')
        predicted=next((t for t in ('ai','au') if result['actual_phonemes']==TARGET_PHONES[t]),None)
        rows.append(dict(split=split,target=target,speaker=speaker,source=str(path.relative_to(SOURCE)),
                         segment_index=idx,start=int(start),end=int(end),predicted=predicted,
                         confidence=result['confidence'],phones=result['actual_phonemes'],scorable=result['scorable']))
        print(f'{len(rows)} {split} {target} {speaker}',flush=True)
    def stats(split,threshold):
        accepted=[r for r in rows if r['split']==split and r['predicted'] and (r['confidence'] or 0)>=threshold]
        return dict(accepted=len(accepted),correct=sum(r['target']==r['predicted'] for r in accepted),
                    precision=sum(r['target']==r['predicted'] for r in accepted)/len(accepted) if accepted else None)
    candidates=sorted({0.,*[r['confidence'] for r in rows if r['split']=='train' and r['predicted'] and r['confidence'] is not None]})
    # Minimum10 predicted diphthongs and90% precision predeclared; exploratory only.
    feasible=[t for t in candidates if stats('train',t)['accepted']>=10 and stats('train',t)['precision']>=.9]
    threshold=min(feasible) if feasible else None
    result=dict(seed=6092028,selection='One random energy-segmented clip per train/validation speaker/category; all12 categories, no test speakers.',
                candidate_selection='Lowest train threshold yielding >=90% precision and >=10 predicted diphthongs. Diagnostic only; small correlated sample.',
                threshold=threshold,ungated={s:stats(s,0.) for s in ('train','validation')},
                gated={s:stats(s,threshold) for s in ('train','validation')} if threshold is not None else None,rows=rows)
    out=BASE.parents[2]/'.runlogs/diphthong-confidence-audit.json'
    out.write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in result.items() if k!='rows'},indent=2))

if __name__=='__main__': main()
