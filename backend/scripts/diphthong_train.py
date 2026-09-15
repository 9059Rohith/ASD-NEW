"""Fixed-protocol AI/AU/other auxiliary. Never alters paired classifier weights.

Train speakers fit400 ExtraTrees(min_leaf3, seed260906), validation speakers
sigmoid-calibrate. Confidence0.60 is fixed before evaluation. Deployment gate:
validation macroF1>=0.65, accepted accuracy>=0.80, and accepted correct recall
>=0.40 for BOTH AI/AU. No candidate search or test-dependent selection.
The existing baseline test split has been audited before this experiment;
test results are a frozen-protocol follow-up, not a pristine unseen benchmark.
"""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
os.environ.setdefault('OMP_NUM_THREADS','2')
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import json,hashlib,math
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import joblib,numpy as np,soundfile as sf
from scipy.signal import resample_poly
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report,confusion_matrix,accuracy_score
from vowel_train import SOURCE,BASE,SOURCE_LABELS,process_file,split_recording
from app.services.vowel_analysis import extract_features

OUT=BASE.parent/'diphthong-classifier'
VERSION='tamil-diphthong-v1-2026-09-06'
PROTOCOL=dict(estimator='ExtraTrees',n_estimators=400,min_samples_leaf=3,random_state=260906,
              classes=['AI','AU','OTHER'],confidence_threshold=.6,calibration='sigmoid on validation speakers',
              viability='validation macroF1>=.65; accepted accuracy>=.80; AI and AU accepted-correct recall>=.40',
              test_visibility='Prior baseline test audit seen; no tuning on this follow-up test.')

def diph_file(path):
    cache=BASE/'data/diphthong-shards';cache.mkdir(exist_ok=True)
    digest=hashlib.sha256(path.read_bytes()).hexdigest(); shard=cache/f'{digest}.joblib'
    if shard.exists():return joblib.load(shard)
    audio,rate=sf.read(path,dtype='float32')
    if audio.ndim>1:audio=audio.mean(axis=1)
    if rate!=16000:
        d=math.gcd(rate,16000);audio=resample_poly(audio,16000//d,rate//d)
    rows=[];counts=Counter()
    for idx,(start,end) in enumerate(split_recording(audio)):
        f=extract_features(audio[start:end]);counts[f['status']]+=1
        if f['status']!='ok':continue
        rows.append(dict(path=str(path.relative_to(SOURCE)),speaker=path.stem.split('T')[0],
                         target='AI' if path.parent.name=='i' else 'AU',start=int(start),end=int(end),index=idx,
                         features=f['identity_features'],duration=f['duration_seconds'],flatness=f['spectral_flatness']))
    result=rows,dict(path=str(path.relative_to(SOURCE)),sha256=digest,statuses=dict(counts))
    joblib.dump(result,shard);return result

def main():
    OUT.mkdir(exist_ok=True)
    (OUT/'protocol.json').write_text(json.dumps(PROTOCOL,indent=2),encoding='utf8')
    paired_hash=hashlib.sha256((BASE/'classifier.joblib').read_bytes()).hexdigest()
    split=json.loads((BASE/'evaluation.json').read_text())['speaker_splits']
    rows=[];inventory=[]
    for path in sorted(SOURCE.glob('*/*.wav')):
        if path.parent.name in SOURCE_LABELS:
            cached,_=process_file(path)
            rows.extend([{**r,'target':'OTHER'} for r in cached])
    files=sorted(p for p in SOURCE.glob('*/*.wav') if p.parent.name in ('i','av'))
    with ThreadPoolExecutor(max_workers=4) as pool:
        for part,item in pool.map(diph_file,files):
            rows.extend(part);inventory.append(item);print(item,flush=True)
    joblib.dump(rows,OUT/'features.local.joblib',compress=3)
    x=np.array([r['features'] for r in rows]);y=np.array([r['target'] for r in rows])
    masks={s:np.array([r['speaker'] in people for r in rows]) for s,people in split.items()}
    raw=ExtraTreesClassifier(n_estimators=400,min_samples_leaf=3,random_state=260906,n_jobs=4)
    raw.fit(x[masks['train']],y[masks['train']]);print('Fitted train-only trees',flush=True)
    model=CalibratedClassifierCV(raw,method='sigmoid',cv='prefit')
    model.fit(x[masks['validation']],y[masks['validation']]);print('Calibration frozen',flush=True)
    # Train-derived quality ceiling retains paired training gate and 99.5% of
    # accepted training diphthong flatness. No validation/test gate fitting.
    dip_flat=[r['flatness'] for r in rows if r['speaker'] in split['train'] and r['target']!='OTHER']
    paired=joblib.load(BASE/'classifier.joblib')
    flatness=max(paired['spectral_flatness_limit'],float(np.quantile(dip_flat,.995)))
    result=dict(model_version=VERSION,protocol=PROTOCOL,speaker_splits=split,source='https://doi.org/10.17632/2dnxmvm22k.1',
                license='CC BY 4.0',source_label_mapping={'i':'AI','av':'AU','all10paired':'OTHER'},inventory=inventory,
                paired_artifact_sha256=paired_hash,spectral_flatness_limit=flatness,partitions={})
    for name,mask in masks.items():
        prob=model.predict_proba(x[mask]);pred=model.classes_[prob.argmax(axis=1)];actual=y[mask];accepted=prob.max(axis=1)>=.6
        report=classification_report(actual,pred,labels=PROTOCOL['classes'],output_dict=True,zero_division=0)
        result['partitions'][name]=dict(n=int(mask.sum()),counts=dict(Counter(actual)),accuracy=float(accuracy_score(actual,pred)),
            classification_report=report,confusion_matrix=confusion_matrix(actual,pred,labels=PROTOCOL['classes']).tolist(),
            accepted=int(accepted.sum()),coverage=float(accepted.mean()),accepted_accuracy=float(np.mean(actual[accepted]==pred[accepted])) if accepted.any() else None,
            accepted_correct_recall={c:float(np.sum(accepted&(actual==c)&(pred==c))/np.sum(actual==c)) for c in PROTOCOL['classes']})
        print(name,json.dumps(result['partitions'][name]),flush=True)
    val=result['partitions']['validation']
    viable=val['classification_report']['macro avg']['f1-score']>=.65 and (val['accepted_accuracy'] or 0)>=.8 and all(val['accepted_correct_recall'][c]>=.4 for c in ('AI','AU'))
    result['deployment_gate_passed']=viable
    artifact=dict(schema_version=1,model_version=VERSION,identity=model,confidence_threshold=.6,spectral_flatness_limit=flatness,
                  deployment_gate_passed=viable,evaluation_summary=result['partitions']['test'])
    artifact_path=OUT/('classifier.joblib' if viable else 'candidate-not-deployed.joblib')
    temporary=artifact_path.with_suffix('.next.joblib')
    joblib.dump(artifact,temporary,compress=3);temporary.replace(artifact_path)
    result['artifact_sha256']=hashlib.sha256(artifact_path.read_bytes()).hexdigest()
    assert hashlib.sha256((BASE/'classifier.joblib').read_bytes()).hexdigest()==paired_hash
    (OUT/'evaluation.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print('Deployment gate:',viable,'artifact:',artifact_path,flush=True)

if __name__=='__main__':main()
