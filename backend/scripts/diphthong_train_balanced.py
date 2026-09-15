"""Predeclared second candidate: balanced seven-way vowel identity.

Validation-only decision, fixed400trees/minleaf3/seed260906/.60confidence.
Seven identities remove the heterogeneous OTHER class. Same viability gate:
val macroF1>=.65, accepted accuracy>=.80, AI/AU accepted-correct recall>=.40.
Only if validation passes is the frozen model evaluated on the historical test
split. Prior test visibility and iterative validation are explicitly retained.
"""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
os.environ.setdefault('OMP_NUM_THREADS', '2')
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import json,hashlib,joblib,numpy as np
import math
from concurrent.futures import ThreadPoolExecutor
import soundfile as sf
import scipy, sklearn
from scipy.signal import resample_poly
from collections import Counter
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report,confusion_matrix,accuracy_score
from diphthong_train import OUT,BASE
from vowel_train import SOURCE, SOURCE_LABELS
from app.services.vowel_analysis import extract_features

def add_trajectory(rows):
    cache=BASE/'data/trajectory-shards';cache.mkdir(exist_ok=True)
    groups={}
    for row in rows:groups.setdefault(row['path'],[]).append(row)
    def process(item):
        name,part=item;path=SOURCE/name
        source_hash=hashlib.sha256(path.read_bytes()).hexdigest()
        digest=hashlib.sha256((name+source_hash+str([(r['start'],r['end']) for r in part])).encode()).hexdigest()
        shard=cache/f'{digest}.joblib'
        if shard.exists():return joblib.load(shard)
        audio,rate=sf.read(path,dtype='float32')
        if audio.ndim>1:audio=audio.mean(axis=1)
        if rate!=16000:
            d=math.gcd(rate,16000);audio=resample_poly(audio,16000//d,rate//d)
        for row in part:
            f=extract_features(audio[row['start']:row['end']])
            row['features']=np.r_[row['features'],f['third_features'][-1][:20]-f['third_features'][0][:20]]
        joblib.dump(part,shard);return part
    output=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for part in pool.map(process,groups.items()):
            output.extend(part);print('Trajectory features',len(output),flush=True)
    return output

def main():
    temporal='--temporal' in sys.argv
    prior=json.loads((OUT/'evaluation.json').read_text())
    (OUT/'first-candidate-evaluation.json').write_text(json.dumps(prior,indent=2),encoding='utf8')
    protocol=dict(strategy='seven-identity balanced ExtraTrees',n_estimators=400,min_samples_leaf=3,random_state=260906,
                  class_weight='balanced',classes=['A','AI','AU','E','I','O','U'],confidence_threshold=.6,
                  calibration='sigmoid validation speakers',selection='One predeclared balanced7 candidate; validation-only deployment gate',
                  gate='val macroF1>=.65, accepted accuracy>=.80, accepted-correct recall>=.40 for AI and AU',
                  prior_visibility='Baseline and first candidate historical test results seen. Iterative validation; no test-driven tuning.')
    if temporal:
        protocol.update(strategy='balanced seven-identity with 20 last-minus-first-third MFCC mean deltas',
                        features='80 MFCC statistics + 20 temporal deltas; no duration',
                        sampling='Fixed30 random rows per train/validation speaker/source category, seed260906; full test only after validation passes')
    (OUT/('temporal-protocol.json' if temporal else 'balanced-protocol.json')).write_text(json.dumps(protocol,indent=2),encoding='utf8')
    rows=joblib.load(OUT/'features.local.joblib');split=prior['speaker_splits']
    test_rows=[r for r in rows if r['speaker'] in split['test']]
    if temporal:
        rng=np.random.default_rng(260906);groups={}
        for row in rows:
            if row['speaker'] not in split['test']:groups.setdefault(row['path'],[]).append(row)
        rows=add_trajectory([part[int(i)] for part in groups.values() for i in rng.choice(len(part),min(30,len(part)),replace=False)])
    x=np.array([r['features'] for r in rows]);y=np.array([r['identity'] if r['target']=='OTHER' else r['target'] for r in rows])
    masks={s:np.array([r['speaker'] in people for r in rows]) for s,people in split.items()}
    raw=ExtraTreesClassifier(n_estimators=400,min_samples_leaf=3,random_state=260906,n_jobs=4,class_weight='balanced')
    raw.fit(x[masks['train']],y[masks['train']]);print('Balanced seven-way fitted',flush=True)
    model=CalibratedClassifierCV(raw,method='sigmoid',cv='prefit');model.fit(x[masks['validation']],y[masks['validation']])
    def evaluate(name):
        mask=masks[name];p=model.predict_proba(x[mask]);pred=model.classes_[p.argmax(axis=1)];actual=y[mask];gate=p.max(axis=1)>=.6
        return dict(n=int(mask.sum()),counts=dict(Counter(actual)),accuracy=float(accuracy_score(actual,pred)),
            classification_report=classification_report(actual,pred,labels=protocol['classes'],output_dict=True,zero_division=0),
            confusion_matrix=confusion_matrix(actual,pred,labels=protocol['classes']).tolist(),accepted=int(gate.sum()),coverage=float(gate.mean()),
            accepted_accuracy=float(np.mean(actual[gate]==pred[gate])) if gate.any() else None,
            accepted_correct_recall={c:float(np.sum(gate&(actual==c)&(pred==c))/np.sum(actual==c)) for c in protocol['classes']})
    val=evaluate('validation');print('validation',json.dumps(val),flush=True)
    viable=val['classification_report']['macro avg']['f1-score']>=.65 and (val['accepted_accuracy'] or 0)>=.8 and all(val['accepted_correct_recall'][c]>=.4 for c in ('AI','AU'))
    result={**prior,'model_version':'tamil-diphthong-v3-trajectory-2026-09-06' if temporal else 'tamil-diphthong-v2-balanced7-2026-09-06','protocol':protocol,'deployment_gate_passed':viable,
            'source_label_mapping':{**{source:target[0].upper() for source,target in SOURCE_LABELS.items()},'i':'AI','av':'AU'},'partitions':{'validation':val}}
    result['software_versions']={'numpy':np.__version__,'scipy':scipy.__version__,'scikit_learn':sklearn.__version__,'joblib':joblib.__version__}
    if viable:
        if temporal:
            rows.extend(add_trajectory(test_rows))
            x=np.array([r['features'] for r in rows]);y=np.array([r['identity'] if r['target']=='OTHER' else r['target'] for r in rows])
            masks={s:np.array([r['speaker'] in people for r in rows]) for s,people in split.items()}
        result['partitions']['train']=evaluate('train');result['partitions']['test']=evaluate('test');print('test',json.dumps(result['partitions']['test']),flush=True)
    artifact=dict(schema_version=1,model_version=result['model_version'],identity=model,confidence_threshold=.6,
                  spectral_flatness_limit=prior['spectral_flatness_limit'],deployment_gate_passed=viable,
                  feature_schema='mfcc80_delta20' if temporal else 'mfcc80',evaluation_summary=result['partitions'].get('test',{}))
    path=OUT/('classifier.joblib' if viable else 'temporal-candidate-not-deployed.joblib' if temporal else 'balanced-candidate-not-deployed.joblib')
    temporary=path.with_suffix('.next.joblib');joblib.dump(artifact,temporary,compress=3);temporary.replace(path)
    result['artifact_sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
    assert hashlib.sha256((BASE/'classifier.joblib').read_bytes()).hexdigest()==prior['paired_artifact_sha256']
    (OUT/('evaluation.json' if viable else 'temporal-candidate-evaluation.json' if temporal else 'balanced-candidate-evaluation.json')).write_text(json.dumps(result,indent=2),encoding='utf8')
    print('Deployment gate:',viable,flush=True)

if __name__=='__main__':main()
