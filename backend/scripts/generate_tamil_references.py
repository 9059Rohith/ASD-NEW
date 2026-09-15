"""Generate reproducible local synthetic Tamil listening examples.

Run from backend: USE_TF=0 python scripts/generate_tamil_references.py
Verify without model dependencies: python scripts/generate_tamil_references.py --verify-only
The outputs are listening aids, never human pronunciation evaluation fixtures.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import wave

os.environ.setdefault('USE_TF', '0')
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.tamil_curriculum import TAMIL_CATALOG

MODEL_ID = 'facebook/mms-tts-tam'
REVISION = 'e9cf59dae34f0f51e3b1842876a658e4516f9fe4'
SEED = 20260906
OUTPUT = BACKEND.parent / 'frontend/public/assets/tamil-reference'
MODEL_DIRECTORY = BACKEND / 'models/tamil-tts'
HUMAN_SEGMENTS = {
    'letter-a': {'path': 'a/F943Ta.wav', 'start': 21920, 'end': 29120,
                 'sha256': '056a95cccff559bbbe1b9faac724deb954d8a281847de8f84bfaea9cd18f3c4b', 'segment_index': 1},
    'letter-aa': {'path': 'aa/F943Taa.wav', 'start': 23200, 'end': 38720,
                  'sha256': 'b828cfa018b73f5d07b9999c5212f3276a45d9a2f68ba05e4e030bbeef3e4278', 'segment_index': 1},
    'letter-i': {'path': 'e/F943Te.wav', 'start': 23200, 'end': 31680,
                 'sha256': '1391adaba1ecedaab79c946b6e1f361c81a1abaf2a97e7421f0a5d78e96b5af4', 'segment_index': 0},
    'letter-ii': {'path': 'ee/F943Tee.wav', 'start': 21920, 'end': 34880,
                  'sha256': '2f60fb271083f0cc7b79108454b4aff79f220f8c003f5988cbb6265dd6b31e1b', 'segment_index': 1},
    'letter-u': {'path': 'u/F943Tu.wav', 'start': 17120, 'end': 25280,
                 'sha256': 'fe14dfa6dc20a1391862f96a094b1710cadf5e4a420e46ffe36617f0b5fb0509', 'segment_index': 0},
    'letter-uu': {'path': 'uu/F943Tuu.wav', 'start': 22560, 'end': 34560,
                  'sha256': '2298a8ef5707dfb6d3eb2921724885930e59674ca57c1ed6cbb83a4773da7141', 'segment_index': 1},
    'letter-e': {'path': 'eh/F943Teh.wav', 'start': 18080, 'end': 28000,
                 'sha256': '5fc703cee48adefcbbea9641dd889aecab269604df4031b7f41af1a236bacce3', 'segment_index': 1},
    'letter-ee': {'path': 'ehh/F943Tehh.wav', 'start': 17440, 'end': 30240,
                  'sha256': '62eab5d3c1a64bb3eeb9799318c543d5fa8f1d58be6b64d26530c11c305b8b3a', 'segment_index': 0},
    'letter-o': {'path': 'o/F943To.wav', 'start': 14880, 'end': 22080,
                 'sha256': 'a7a31fe85421e9e1e7dec420bd697ba6428a36765294757826575de2d95edfda', 'segment_index': 0},
    'letter-oo': {'path': 'oo/F943Too.wav', 'start': 18080, 'end': 32480,
                  'sha256': '0b74b85174d75f74b1252d8d86484ed40514262986544eea1fc4e7644635a376', 'segment_index': 1},
    'letter-ai': {'path': 'i/F943Ti.wav', 'start': 31840, 'end': 39360,
                  'sha256': 'bc78c16aaadecce8f9660cd728a1a1b59be1faaac83ebf7028d18402852b25e5',
                  'phones': ['aɪ'], 'confidence': .7758},
    'letter-au': {'path': 'av/F943Tav.wav', 'start': 30880, 'end': 39520,
                  'sha256': 'ef4bba24e5337a8fae3b917658fad3d4fffb6ec2dd31a6f355ffee2fc7151d0b',
                  'phones': ['aʊ'], 'confidence': .2237},
}
HUMAN_SOURCE_LABELS = {'a': 'a', 'aa': 'aa', 'e': 'i', 'ee': 'ii', 'eh': 'e',
                       'ehh': 'ee', 'o': 'o', 'oo': 'oo', 'u': 'u', 'uu': 'uu'}


def validate_wav(path):
    import numpy as np
    with wave.open(str(path), 'rb') as handle:
        channels, width, rate, frames = handle.getnchannels(), handle.getsampwidth(), handle.getframerate(), handle.getnframes()
        pcm = np.frombuffer(handle.readframes(frames), dtype='<i2').astype(np.float64) / 32768
    assert channels == 1 and width == 2 and rate == 16000, f'Invalid WAV format: {path.name}'
    duration = frames / rate
    assert .12 <= duration <= 20, f'Invalid duration: {path.name}: {duration}'
    assert pcm.size and np.isfinite(pcm).all(), f'Empty/nonfinite audio: {path.name}'
    peak, rms = float(np.abs(pcm).max()), float(np.sqrt(np.mean(pcm ** 2)))
    assert peak >= .01 and rms >= .002, f'Silent output: {path.name}'
    assert float(np.mean(np.abs(pcm) >= .995)) < .01, f'Clipped output: {path.name}'
    return {'sample_rate': rate, 'channels': channels, 'sample_width_bytes': width,
            'duration_seconds': round(duration, 4), 'frames': frames, 'peak': round(peak, 6),
            'rms': round(rms, 6), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def verify():
    manifest = json.loads((OUTPUT / 'manifest.json').read_text(encoding='utf-8'))
    catalog = {row['id']: row for row in TAMIL_CATALOG if row.get('audio_url')}
    generated = set()
    for row in manifest['items']:
        assert row['id'] in catalog and row['text'] == catalog[row['id']]['text']
        assert row['audio_url'] == catalog[row['id']]['audio_url']
        assert row['filename'] == Path(row['audio_url']).name
        if row['audio_kind'] == 'synthetic_tamil':
            assert row['unknown_tamil_character_ratio'] == 0
        else:
            assert row['audio_kind'] == 'human_tamil' and row['source']['speaker_partition'] == 'train'
        assert validate_wav(OUTPUT / row['filename']) == row['audio']
        generated.add(row['id'])
    excluded = {row['id'] for row in manifest['excluded']}
    assert generated.isdisjoint(excluded) and generated | excluded == set(catalog)
    word_rows = [row for row in manifest['items'] if row['kind'] == 'word']
    assert len(word_rows) == 10
    assert all(row.get('synthesis_provider') == 'Microsoft Edge online speech service'
               and row.get('synthesis_voice') == 'ta-IN-ValluvarNeural'
               and row.get('synthesis_text') == row['text'] for row in word_rows)
    assert manifest['model_revision'] == REVISION and manifest['seed'] == SEED
    print(f'Validated {len(generated)} Tamil WAV files; {len(excluded)} unavailable examples.', flush=True)


def human_example(item):
    import soundfile as sf
    provenance = HUMAN_SEGMENTS[item['id']]
    base = BACKEND / 'models/vowel-classifier'
    splits = json.loads((base / 'evaluation.json').read_text(encoding='utf-8'))['speaker_splits']
    assert 'F943' in splits['train'] and 'F943' not in splits['test'] + splits['validation']
    source = base / 'data/Tamil Alphabets' / provenance['path']
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    assert digest == provenance['sha256'], f'Source fingerprint changed: {source.name}'
    samples, rate = sf.read(source, dtype='float32')
    assert rate == 16000 and samples.ndim == 1
    source_label = provenance['path'].split('/')[0]
    if source_label in HUMAN_SOURCE_LABELS:
        assert HUMAN_SOURCE_LABELS[source_label] == item['phoneme_target']
        from scripts.vowel_train import split_recording
        segments = list(split_recording(samples))
        assert tuple(segments[provenance['segment_index']]) == (provenance['start'], provenance['end'])
    path = OUTPUT / Path(item['audio_url']).name
    if path.exists():
        raise FileExistsError(f'Unmanifested reference would be overwritten: {path}')
    sf.write(path, samples[provenance['start']:provenance['end']], rate, subtype='PCM_16')
    row = {'id': item['id'], 'text': item['text'], 'kind': item['kind'], 'audio_kind': 'human_tamil',
            'filename': path.name, 'audio_url': item['audio_url'],
            'license': 'CC-BY-4.0', 'license_url': 'https://creativecommons.org/licenses/by/4.0/',
            'source': {'dataset': 'Tamil vowels-speech database', 'version': 1,
                'url': 'https://doi.org/10.17632/2dnxmvm22k.1', 'filename': provenance['path'],
                'sha256': digest, 'speaker': 'F943', 'speaker_partition': 'train',
                'segment_index': provenance.get('segment_index', 1),
                'start_sample': provenance['start'], 'end_sample': provenance['end'], 'sample_rate': rate,
                'onset_seconds': provenance['start'] / rate, 'offset_seconds': provenance['end'] / rate,
                'label_mapping': (f'Source folder {source_label} maps to {item["text"]} per '
                                  'backend/scripts/vowel_train.py SOURCE_LABELS.'
                                  if source_label in HUMAN_SOURCE_LABELS else
                                  'Archive i interpreted as ஐ /ai/; av interpreted as ஔ /au/.'),
                'changes': 'One repetition extracted at vowel_train.split_recording energy boundaries; PCM16 encoding. No pitch/time changes.'},
            'audio': validate_wav(path)}
    if 'phones' in provenance:
        row['selection_acoustic_check'] = {
            'model_id': 'facebook/wav2vec2-lv-60-espeak-cv-ft',
            'actual_phonemes': provenance['phones'], 'confidence': provenance['confidence'],
            'purpose': 'Spot-check of this selected listening example; not independent model accuracy evidence.'}
    return row


def generate():
    import numpy as np
    import torch
    import transformers
    from huggingface_hub import snapshot_download
    from transformers import AutoTokenizer, VitsConfig, VitsModel
    from safetensors.torch import load_file

    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    if not all((MODEL_DIRECTORY / name).exists() for name in
               ('config.json', 'vocab.json', 'model.safetensors', 'tokenizer_config.json')):
        snapshot_download(MODEL_ID, revision=REVISION, local_dir=str(MODEL_DIRECTORY),
                          allow_patterns=['*.json', 'model.safetensors', 'README.md'])
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIRECTORY), local_files_only=True)
    model = VitsModel(VitsConfig.from_pretrained(str(MODEL_DIRECTORY), local_files_only=True))
    # Torch 2.12 uses parametrizations.weight.original{0,1}, whereas this
    # checkpoint stores the equivalent legacy weight_g/weight_v names.
    # Map names only and require a STRICT complete load; never synthesize with
    # randomly initialized missing weights from an incompatible loader.
    expected_keys = set(model.state_dict())
    checkpoint = load_file(str(MODEL_DIRECTORY / 'model.safetensors'), device='cpu')
    state = {}
    renamed_weights = 0
    for key, value in checkpoint.items():
        destination = key
        for old, new in (('.weight_g', '.parametrizations.weight.original0'),
                         ('.weight_v', '.parametrizations.weight.original1')):
            if key.endswith(old) and key[:-len(old)] + new in expected_keys:
                destination = key[:-len(old)] + new
        renamed_weights += destination != key
        state[destination] = value
    model.load_state_dict(state, strict=True)
    model.eval().to('cpu')
    print(f'Strictly loaded all checkpoint weights ({renamed_weights} weight-normalization key renames).', flush=True)
    vocab = tokenizer.get_vocab()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {'model_id': MODEL_ID, 'model_revision': REVISION,
                'model_url': f'https://huggingface.co/{MODEL_ID}/tree/{REVISION}',
                'license': 'CC-BY-NC-4.0', 'license_url': 'https://creativecommons.org/licenses/by-nc/4.0/',
                'audio_kinds': ['synthetic_tamil', 'human_tamil'], 'seed': SEED,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'torch_version': torch.__version__, 'transformers_version': transformers.__version__,
                'cpu_threads': 2, 'tokenizer_is_uroman': tokenizer.is_uroman,
                'checkpoint_load': {'strict': True, 'weight_norm_key_renames': renamed_weights},
                'purpose': 'Listening aids, not independent pronunciation accuracy benchmarks.',
                'tokenizer_limitation': 'Pinned MMS Tamil tokenizer omits standalone ஔ U+0B94; human dataset clips are used for both diphthongs.',
                'items': [], 'excluded': []}
    previous_path = OUTPUT / 'manifest.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else None
    if previous is not None and (previous['model_id'] != MODEL_ID or previous['model_revision'] != REVISION):
        raise ValueError('Existing Tamil reference manifest uses a different model revision.')
    previous_rows = {row['id']: row for row in previous['items']} if previous else {}
    for item in TAMIL_CATALOG:
        if not item.get('audio_url'):
            continue
        existing = previous_rows.get(item['id'])
        if existing:
            if existing['text'] != item['text'] or existing['audio_url'] != item['audio_url']:
                raise ValueError(f"Existing reference does not match catalog: {item['id']}")
            if validate_wav(OUTPUT / existing['filename']) != existing['audio']:
                raise ValueError(f"Existing reference failed validation: {item['id']}")
            manifest['items'].append(existing)
            continue
        if item['id'] in HUMAN_SEGMENTS:
            manifest['items'].append(human_example(item))
            print(f"Extracted human example {item['id']}", flush=True)
            continue
        # VitsTokenizer silently drops out-of-vocabulary characters during
        # normalization. Inspect original Tamil script BEFORE tokenization.
        tamil_chars = [char for char in item['text'] if '\u0b80' <= char <= '\u0bff']
        unknown = [char for char in tamil_chars if char not in vocab]
        ratio = len(unknown) / max(1, len(tamil_chars))
        if unknown:
            manifest['excluded'].append({'id': item['id'], 'text': item['text'],
                'reason': 'The pinned Tamil tokenizer cannot faithfully encode this independent letter.',
                'unsupported_characters': sorted(set(unknown)), 'unknown_tamil_character_ratio': ratio,
                'fallback': 'Tamil browser voice when available; otherwise show example unavailable.'})
            print(f"Excluded {item['id']}: unsupported Tamil code points {[hex(ord(c)) for c in unknown]}", flush=True)
            continue
        inputs = tokenizer(item['text'], return_tensors='pt')
        token_ids = inputs['input_ids'][0].tolist()
        assert any(value != tokenizer.pad_token_id for value in token_ids), f"Empty tokens for {item['id']}"
        if tokenizer.unk_token_id is not None:
            assert tokenizer.unk_token_id not in token_ids
        torch.manual_seed(SEED)
        with torch.inference_mode():
            waveform = model(**inputs).waveform[0].cpu().numpy()
        assert waveform.size and np.isfinite(waveform).all()
        peak = float(np.abs(waveform).max())
        # Peak attenuation only when needed prevents clipping; no pitch, time
        # stretching, splicing or language substitutions are applied.
        gain = min(1.0, .95 / peak) if peak else 1.0
        pcm = (waveform * gain * 32767).round().astype('<i2')
        path = OUTPUT / Path(item['audio_url']).name
        if path.exists():
            raise FileExistsError(f'Unmanifested reference would be overwritten: {path}')
        with wave.open(str(path), 'wb') as handle:
            handle.setnchannels(1); handle.setsampwidth(2); handle.setframerate(model.config.sampling_rate)
            handle.writeframes(pcm.tobytes())
        audio = validate_wav(path)
        manifest['items'].append({'id': item['id'], 'text': item['text'], 'kind': item['kind'],
            'audio_kind': 'synthetic_tamil', 'license': 'CC-BY-NC-4.0',
            'synthesis_text': item['text'], 'filename': path.name, 'audio_url': f'/assets/tamil-reference/{path.name}',
            'unknown_tamil_character_ratio': ratio, 'input_token_ids': token_ids,
            'seed': SEED, 'peak_gain': gain, 'audio': audio})
        print(f"Generated {item['id']}: {audio['duration_seconds']} seconds", flush=True)
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    synthetic_count = sum(row['audio_kind'] == 'synthetic_tamil' for row in manifest['items'])
    word_voice_count = sum(row['kind'] == 'word' and row.get('synthesis_voice') == 'ta-IN-ValluvarNeural'
                           for row in manifest['items'])
    mms_count = synthetic_count - word_voice_count
    human_count = sum(row['audio_kind'] == 'human_tamil' for row in manifest['items'])
    (OUTPUT / 'ATTRIBUTION.md').write_text(f'''# Tamil listening examples

The {synthetic_count} word and sentence WAVs are computer-generated listening aids.
The {human_count} vowel WAVs are human recordings extracted from the dataset below.
None of these selected examples is an independent model accuracy benchmark.

## Synthetic words and sentences

The {mms_count} sentence examples were generated locally with Meta AI's [{MODEL_ID}](https://huggingface.co/{MODEL_ID}),
revision `{REVISION}`, using seed `{SEED}` and two CPU threads.
Model authors: Vineel Pratap et al., Meta AI.
Paper: [Scaling Speech Technology to 1,000+ Languages](https://arxiv.org/abs/2305.13516).
Model license: [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/).
These project examples are supplied for noncommercial educational use with
attribution. No endorsement by Meta AI or the model authors is implied.

All {word_voice_count} word examples were generated with Microsoft Edge's online
Tamil speech service using the native Tamil voice `ta-IN-ValluvarNeural`.
Their manifest entries record the exact synthesis text, provider, voice, audio
measurements and file hashes.

The project supplied the Tamil practice texts and synthesized mono 16 kHz PCM16
WAVs. Peak attenuation is applied only when needed to prevent clipping. No
user recording was used or transmitted. The manifest records exact text, input
tokens, dependency versions, duration, gain and SHA-256 for each output.

The model's vocabulary lacks standalone ஔ (U+0B94). Both diphthongs therefore
use human examples, without deleting or substituting the requested letter.
Synthetic speech may have pronunciation and prosody
limitations and is not a normative Tamil dialect reference.

## Human vowel recordings

Revathi Arunachalam, Vijayakrishnan VK, Nandhakumar N and Akilan A (2025).
[Tamil vowels-speech database, version 1](https://doi.org/10.17632/2dnxmvm22k.1).
Licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
The authors have not endorsed this application.

Changes: individual repetitions extracted from F943 source WAVs at energy
segmentation boundaries, encoded as mono 16 kHz PCM16.
These are training-speaker F943 clips. Source folder `i` is interpreted as ஐ
and `av` as ஔ; `e`/`ee` map to இ/ஈ and `eh`/`ehh` to எ/ஏ, consistent with the
existing label audit. Exact source hashes and sample/time boundaries are in the
manifest. A local ONNX spot-check heard /aɪ/ and /aʊ/ for the two diphthongs;
the latter had low token confidence (0.2237). The other ten clips are sourced
from corpus labels and are not independently validated pronunciation standards.
This spot-check supports example selection and does not establish universal
Tamil pronunciation or independent accuracy. No synthetic clip is substituted
for a human recording.

To regenerate: from `backend`, run `USE_TF=0 python scripts/generate_tamil_references.py`.
On PowerShell, set `$env:USE_TF='0'` first, then run the Python command.
To verify files without loading the model, append `--verify-only`.
''', encoding='utf-8')
    verify()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    arguments = parser.parse_args()
    verify() if arguments.verify_only else generate()
