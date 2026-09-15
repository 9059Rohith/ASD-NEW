"""Probe a local faster-whisper model on shipped Tamil examples.

This is an integration smoke test on synthesized lesson audio, not an
independent human-speech accuracy benchmark. No model weights are downloaded.

From backend: python scripts/benchmark_tamil_asr.py --model PATH
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.tamil_validation import compare_tamil_text


ROOT = Path(__file__).resolve().parents[2]
AUDIO = ROOT / 'frontend' / 'public' / 'assets' / 'tamil-reference'


def benchmark(model_path: Path, threads: int = 2) -> dict:
    from faster_whisper import WhisperModel

    model_path = model_path.resolve()
    weights = model_path / 'model.bin'
    if not weights.is_file():
        raise FileNotFoundError(f'Missing local model weights: {weights}')
    manifest = json.loads((AUDIO / 'manifest.json').read_text(encoding='utf-8'))
    model = WhisperModel(str(model_path), device='cpu', compute_type='int8',
                         cpu_threads=threads, num_workers=1)
    rows = []
    for item in manifest['items']:
        if item['kind'] not in {'word', 'sentence'}:
            continue
        path = AUDIO / item['filename']
        if not path.is_file():
            raise FileNotFoundError(path)
        started = time.monotonic()
        segments, _ = model.transcribe(str(path), language='ta', beam_size=1,
                                       temperature=0, condition_on_previous_text=False,
                                       vad_filter=False)
        transcript = ''.join(segment.text for segment in segments).strip()
        comparison = compare_tamil_text(item['text'], transcript, kind=item['kind'])
        rows.append({'id': item['id'], 'target': item['text'], 'transcript': transcript,
                     'correct': comparison['correct'], 'similarity': comparison['similarity'],
                     'elapsed_seconds': round(time.monotonic() - started, 2)})
        print(f"{item['id']}: {transcript[:80]!r} correct={comparison['correct']}",
              file=sys.stderr, flush=True)
    digest = hashlib.sha256()
    with weights.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return {'scope': 'shipped synthetic word/sentence listening examples only',
            'model_sha256': digest.hexdigest(),
            'count': len(rows), 'matched': sum(row['correct'] for row in rows),
            'rows': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--threads', type=int, default=2)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not 1 <= args.threads <= 16:
        parser.error('--threads must be between 1 and 16')
    report = benchmark(args.model, args.threads)
    content = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(content, encoding='utf-8')
    else:
        print(content)
