"""Regrade saved Tamil ASR attempts made with permissive sentence matching.

Run from backend. The default is read-only; pass --apply after reviewing the
aggregate dry-run count. No audio or user identifier is printed.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.database import build_mongo_client_options
from app.services.tamil_validation import grade_tamil_transcript
from app.tamil_curriculum import BY_ID


OLD_METHOD = 'tamil_text_similarity_v1'


def regrade_record(row: dict) -> dict | None:
    """Return v2 result fields only for a verifiable old transcript."""
    if row.get('mode') != 'audio' or row.get('score_method') != OLD_METHOD:
        return None
    item = BY_ID.get(row.get('item_id'))
    transcript = row.get('recognized_text')
    if (not row.get('user_id') or not item or item['kind'] not in {'word', 'sentence'} or
            row.get('text') != item['text'] or not isinstance(transcript, str) or not transcript.strip()):
        return None
    return grade_tamil_transcript(item, transcript)


def migrate(collection, *, apply: bool) -> dict[str, int]:
    query = {'mode': 'audio', 'score_method': OLD_METHOD}
    projection = {'_id': 1, 'user_id': 1, 'mode': 1, 'score_method': 1,
                  'item_id': 1, 'text': 1, 'recognized_text': 1, 'correct': 1}
    report = {'examined': 0, 'eligible': 0, 'skipped': 0,
              'false_successes_corrected': 0, 'writes': 0}
    for row in collection.find(query, projection).sort('_id', 1).batch_size(100):
        report['examined'] += 1
        updated = regrade_record(row)
        if updated is None:
            report['skipped'] += 1
            continue
        report['eligible'] += 1
        if row.get('correct') is True and not updated['correct']:
            report['false_successes_corrected'] += 1
        if apply:
            result = collection.update_one(
                {'_id': row['_id'], 'user_id': row['user_id'], 'score_method': OLD_METHOD},
                {'$set': updated},
            )
            report['writes'] += result.modified_count
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='write corrected v2 results')
    args = parser.parse_args()
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError

    options = build_mongo_client_options(
        settings.MONGODB_URL,
        allow_invalid_tls_certificates=settings.MONGODB_TLS_ALLOW_INVALID_CERTIFICATES,
    )
    try:
        with MongoClient(settings.MONGODB_URL, **options) as client:
            client.admin.command('ping')
            report = migrate(client[settings.DB_NAME].tamil_attempts, apply=args.apply)
    except PyMongoError as exc:
        parser.exit(2, f'Cannot reach the configured database ({type(exc).__name__}). No migration result was produced.\n')
    print(json.dumps({'mode': 'apply' if args.apply else 'dry_run', **report}))
