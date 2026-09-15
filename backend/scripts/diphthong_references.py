"""Human representative fixtures, selected only after quantitative evaluation.

These correctness-selected references/heldout clips are NOT accuracy evidence.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import io,json,math,joblib
import numpy as np,soundfile as sf
from scipy.signal import resample_poly
from diphthong_train import OUT
from vowel_train import SOURCE
from app.services.diphthong_analysis import analyze_diphthong

def main():
    report=json.loads((OUT/'evaluation.json').read_text());assert report['deployment_gate_passed']
    rows=joblib.load(OUT/'features.local.joblib');cache={}
    for group,split in [('references','train'),('heldout','test')]:
        folder=OUT/group;folder.mkdir(exist_ok=True);manifest={}
        for target in ('AI','AU'):
            eligible=[r for r in rows if r['target']==target and r['speaker'] in report['speaker_splits'][split]]
            median=np.median([r['duration'] for r in eligible]);eligible.sort(key=lambda r:abs(np.log(r['duration']/median)))
            for row in eligible:
                if row['path'] not in cache:
                    audio,rate=sf.read(SOURCE/row['path'],dtype='float32')
                    if audio.ndim>1:audio=audio.mean(axis=1)
                    if rate!=16000:
                        d=math.gcd(rate,16000);audio=resample_poly(audio,16000//d,rate//d)
                    cache[row['path']]=audio
                clip=cache[row['path']][row['start']:row['end']];out=io.BytesIO();sf.write(out,clip,16000,format='WAV',subtype='PCM_16')
                result=analyze_diphthong(out.getvalue(),target.lower())
                if not result['scorable'] or not result['phoneme_match']:continue
                (folder/f'{target.lower()}.wav').write_bytes(out.getvalue())
                manifest[target.lower()]=dict(path=f'{group}/{target.lower()}.wav',speaker=row['speaker'],source_file=row['path'],
                    source_start_sample=int(row['start']),source_end_sample=int(row['end']),boundary_sample_rate=16000,
                    license='CC BY 4.0',attribution='Revathi Arunachalam, Vijayakrishnan VK, Nandhakumar N, Akilan A (2025), DOI10.17632/2dnxmvm22k.1',
                    modifications='One repetition segmented from continuous human recording; resampled16kHz and PCM16 encoded.',
                    selection='Correctly classified representative fixture; NOT accuracy estimate.')
                break
            if target.lower() not in manifest:raise RuntimeError(f'No genuine reference for {group}/{target}')
        (OUT/f'{group}.json').write_text(json.dumps(manifest,indent=2),encoding='utf8');print(group,json.dumps(manifest),flush=True)

if __name__=='__main__':main()
