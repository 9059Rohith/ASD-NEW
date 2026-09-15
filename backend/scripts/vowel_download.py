"""Download the licensed Mendeley archive, verify publisher SHA256, safely extract.

Requires requests and curl_cffi for the Mendeley public endpoint's browser TLS
compatibility. Neither package is needed by the inference service. The archive
and resumable parts stay in the ignored model data directory.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import subprocess
import time

import requests
from curl_cffi import requests as browser_requests

DATA = Path(__file__).resolve().parents[1] / 'models/vowel-classifier/data'
API = 'https://data.mendeley.com/public-api/datasets/2dnxmvm22k'


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    response = browser_requests.get(API, impersonate='chrome', timeout=60)
    response.raise_for_status()
    metadata = response.json()
    assert metadata['version'] == 1 and metadata['data_licence']['short_name'] == 'CC BY 4.0'
    (DATA / 'source-metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf8')
    details = metadata['files'][0]['content_details']
    response = browser_requests.get(details['download_url'], impersonate='chrome',
                                   headers={'Range': 'bytes=0-1023'}, timeout=60)
    response.raise_for_status()
    url, size, block = response.url, details['size'], 16 * 1024 * 1024
    starts = list(range(0, size, block))

    def download(start):
        end = min(size, start + block) - 1
        path = DATA / f'part-{start:010d}'
        if path.exists() and path.stat().st_size == end - start + 1:
            return
        for attempt in range(8):
            try:
                r = requests.get(url, headers={'Range': f'bytes={start}-{end}'}, timeout=180)
                r.raise_for_status()
                assert r.status_code == 206 and len(r.content) == end - start + 1
                path.write_bytes(r.content)
                print('Downloaded bytes', start, end, flush=True)
                return
            except Exception:
                if attempt == 7:
                    raise
                time.sleep(min(15, 2 ** attempt))

    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(download, starts))
    archive = DATA / 'Tamil Alphabets.full.rar'
    digest = hashlib.sha256()
    with archive.open('wb') as output:
        for start in starts:
            data = (DATA / f'part-{start:010d}').read_bytes()
            digest.update(data)
            output.write(data)
    assert digest.hexdigest() == details['sha256_hash'], 'Publisher archive checksum mismatch'
    listing = subprocess.check_output(['tar', '-tf', str(archive)], text=True)
    root = DATA.resolve()
    for member in listing.splitlines():
        resolved = (DATA / member).resolve()
        assert resolved.is_relative_to(root), 'Unsafe archive member'
    subprocess.run(['tar', '-xf', str(archive), '-C', str(DATA)], check=True)
    print('Verified and extracted', digest.hexdigest())


if __name__ == '__main__':
    main()
