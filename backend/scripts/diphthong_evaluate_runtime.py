"""Frozen runtime follow-up on exact baseline human segment bounds, no fitting."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import io,json,math
from collections import Counter
import numpy as np,soundfile as sf
from scipy.signal import resample_poly
from vowel_train import SOURCE,BASE
from app.services.vowel_analysis import analyze_vowel,TARGETS
from app.services.diphthong_analysis import analyze_diphthong,get_model_status

ROOT=BASE.parents[2]

def scalar(value):
    if isinstance(value,np.generic):return value.item()
    raise TypeError(type(value).__name__)

def evaluate(audio,target):
    out=io.BytesIO();sf.write(out,audio,16000,format='WAV',subtype='FLOAT')
    result=analyze_vowel(out.getvalue(),target) if target in TARGETS else analyze_diphthong(out.getvalue(),target)
    return dict(scorable=result['scorable'],status=result['validation_status'],correct=result['phoneme_match'],
                confidence=result.get('confidence',result.get('vowel_analysis',{}).get('confidence')),
                prediction=[result['vowel_analysis']['identity'],result['vowel_analysis']['length']] if target in TARGETS else result['actual_phonemes'],
                duration=result['vowel_analysis']['duration_seconds'] if target in TARGETS else result['active_duration_ms']/1000)

def stats(rows):
    accepted=[r for r in rows if r['scorable']]
    return dict(n=len(rows),accepted=len(accepted),coverage=len(accepted)/len(rows),correct=sum(r['correct'] for r in accepted),
                accepted_accuracy=sum(r['correct'] for r in accepted)/len(accepted) if accepted else None,statuses=dict(Counter(r['status'] for r in rows)))

def cross_matrix(baseline):
    rows=[];seen=set()
    for source in baseline['human_rows']:
        if source['target'] in seen:continue
        seen.add(source['target']);audio,rate=sf.read(SOURCE/source['source'],dtype='float32')
        if audio.ndim>1:audio=audio.mean(axis=1)
        if rate!=16000:
            d=math.gcd(rate,16000);audio=resample_poly(audio,16000//d,rate//d)
        audio=audio[source['start']:source['end']]
        for target in baseline['per_class']:
            rows.append(dict(source_target=source['target'],requested_target=target,**evaluate(audio,target)))
    return rows

def main():
    assert get_model_status()['status']=='ready'
    baseline=json.loads((ROOT/'.runlogs/twelve-vowel-audit.json').read_text());rows=[];stress=[];audio_cache={};seen=set();rng=np.random.default_rng(6092029)
    if '--matrix-only' in sys.argv:
        path=ROOT/'.runlogs/twelve-vowel-after.json';output=json.loads(path.read_text())
        output['cross_target_matrix']=cross_matrix(baseline)
        path.write_text(json.dumps(output,indent=2,default=scalar),encoding='utf8')
        print('cross-target cases',len(output['cross_target_matrix']),flush=True)
        return
    for old in baseline['human_rows']:
        path=old['source'];target=old['target']
        if path not in audio_cache:
            audio,rate=sf.read(SOURCE/path,dtype='float32')
            if audio.ndim>1:audio=audio.mean(axis=1)
            if rate!=16000:
                d=math.gcd(rate,16000);audio=resample_poly(audio,16000//d,rate//d)
            audio_cache[path]=audio
        audio=audio_cache[path][old['start']:old['end']]
        actual=evaluate(audio,target);pad=evaluate(np.pad(audio,(16000,112000-16000-len(audio))),target)
        rows.append(dict(target=target,speaker=old['speaker'],source=path,start=old['start'],end=old['end'],**actual,
                         padded_scorable=pad['scorable'],padding_prediction_agreement=pad['prediction']==actual['prediction'],
                         padding_duration_agreement=pad['duration']==actual['duration'],baseline_scorable=old['scorable'],baseline_correct=old['correct']))
        if path not in seen:
            seen.add(path);noise=rng.normal(0,np.sqrt(np.mean(audio**2))/np.sqrt(10**.5),len(audio))
            for kind,samples in [('quiet_minus40dB',audio*.01),('5dB_white_noise',audio+noise),('multiple_vowels',np.r_[audio,np.zeros(8000),audio]),('clipped',np.clip(audio/max(abs(audio))*8,-1,1))]:
                stress.append(dict(target=target,speaker=old['speaker'],kind=kind,**evaluate(samples,target)))
        if len(rows)%20==0:
            print('human cases',len(rows),flush=True)
            (ROOT/'.runlogs/twelve-vowel-after-partial.json').write_text(json.dumps(dict(human_rows=rows,stress_rows=stress),default=scalar),encoding='utf8')
    for t in baseline['per_class']:
        for kind,samples in [('silence',np.zeros(112000)),('white_noise',rng.normal(0,.03,16000)),('very_short',rng.normal(0,.03,320))]:
            stress.append(dict(target=t,kind=kind,**evaluate(samples,t)))
    output=dict(model=get_model_status(),protocol='Exact240baselinehumanclips. Stress:firstsampleperheldoutspeaker/category; separate from human metrics.',
                per_class={t:stats([r for r in rows if r['target']==t]) for t in baseline['per_class']},
                per_engine={name:stats([r for r in rows if (r['target'] in TARGETS)==paired]) for name,paired in [('paired',True),('diphthong',False)]},
                stress={kind:stats([r for r in stress if r['kind']==kind]) for kind in sorted({r['kind'] for r in stress})},
                human_rows=rows,stress_rows=stress,cross_target_matrix=cross_matrix(baseline))
    (ROOT/'.runlogs/twelve-vowel-after.json').write_text(json.dumps(output,indent=2,default=scalar),encoding='utf8')
    print(json.dumps({k:v for k,v in output.items() if not k.endswith('_rows')},indent=2,default=scalar))

if __name__=='__main__':main()
