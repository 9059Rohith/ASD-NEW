"""Download and verify the pinned acoustic model, with resumable ranged requests."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import time
import requests

REVISION = '0c57084ff1713c6ab2edd62ff710176c705f2a27'
# The upstream LFS SHA-256 is verified before the checkpoint is installed.
SHA256 = '3d1479b5c70836645a4310902479f7f7e8bbc8c16c58745d918804f4f6f9d120'
SIZE = 317712852
CHUNK = 4 * 1024 * 1024
ROOT = Path(__file__).resolve().parents[1] / 'models' / 'phoneme-onnx'
BASE = f'https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/resolve/{REVISION}/'
TOKENIZER_BASE = 'https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/resolve/c69750f5043e5e1f8a71ab95dd3b98338c280c92/'


def download_part(index):
    start = index * CHUNK
    end = min(SIZE, start + CHUNK) - 1
    part = ROOT / f'part-{index:03d}'
    if part.exists() and part.stat().st_size == end - start + 1:
        return part
    for attempt in range(4):
        try:
            response = requests.get(BASE + 'onnx/model_quantized.onnx?fresh=' + str(time.time_ns()),
                                    headers={'Range': f'bytes={start}-{end}'}, timeout=(20, 90))
            response.raise_for_status()
            if response.status_code != 206 or len(response.content) != end - start + 1:
                raise ValueError('Server did not return the requested byte range')
            part.write_bytes(response.content)
            print(f'Part {index + 1}/{(SIZE + CHUNK - 1) // CHUNK} downloaded', flush=True)
            return part
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1 + attempt)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    checkpoint = ROOT / 'model_quantized.onnx'
    installed = False
    if checkpoint.exists() and checkpoint.stat().st_size == SIZE:
        with checkpoint.open('rb') as source:
            installed = hashlib.file_digest(source, 'sha256').hexdigest() == SHA256
    parts = []
    if not installed:
        with ThreadPoolExecutor(max_workers=16) as pool:
            parts = list(pool.map(download_part, range((SIZE + CHUNK - 1) // CHUNK)))
        temporary = ROOT / 'verified-model.tmp'
        digest = hashlib.sha256()
        with temporary.open('wb') as output:
            for part in parts:
                content = part.read_bytes()
                output.write(content)
                digest.update(content)
        if digest.hexdigest() != SHA256:
            raise RuntimeError('Checkpoint checksum mismatch; model was not installed')
        temporary.replace(checkpoint)
    for name in ['config.json', 'preprocessor_config.json', 'vocab.json']:
        response = requests.get(TOKENIZER_BASE + name, timeout=30)
        response.raise_for_status()
        (ROOT / name).write_bytes(response.content)
    for part in ROOT.glob('part-[0-9][0-9][0-9]'):
        try:
            part.unlink(missing_ok=True)
        except PermissionError:
            pass  # Antivirus may briefly retain a handle; installed model is verified.
    print(f'Verified acoustic phoneme model installed at {ROOT}', flush=True)


if __name__ == '__main__':
    main()
