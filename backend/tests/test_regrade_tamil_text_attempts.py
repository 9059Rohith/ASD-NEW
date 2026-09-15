from copy import deepcopy
from types import SimpleNamespace

from app.tamil_curriculum import BY_ID
from scripts.regrade_tamil_text_attempts import OLD_METHOD, migrate, regrade_record


class Cursor(list):
    def sort(self, key, direction):
        return Cursor(sorted(self, key=lambda row: row[key], reverse=direction < 0))

    def batch_size(self, _size):
        return self


class Collection:
    def __init__(self, rows):
        self.rows = deepcopy(rows)

    def find(self, query, projection):
        return Cursor(deepcopy(row) for row in self.rows
                      if all(row.get(key) == value for key, value in query.items()))

    def update_one(self, query, update):
        for row in self.rows:
            if all(row.get(key) == value for key, value in query.items()):
                row.update(update['$set'])
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)


def test_migration_rejects_false_sentence_success_without_changing_exact_match():
    sentence = BY_ID['sentence-amma-veettil']['text']
    father = sentence.replace(BY_ID['word-amma']['text'], BY_ID['word-appa']['text'])
    base = {'user_id': 'child-1', 'mode': 'audio', 'score_method': OLD_METHOD,
            'item_id': 'sentence-amma-veettil', 'text': sentence, 'correct': True}
    collection = Collection([
        {**base, '_id': 'wrong', 'recognized_text': father},
        {**base, '_id': 'exact', 'recognized_text': sentence},
        {**base, '_id': 'recognition', 'mode': 'recognition', 'recognized_text': father},
    ])
    original = deepcopy(collection.rows)

    assert regrade_record(collection.rows[0])['correct'] is False
    assert migrate(collection, apply=False) == {
        'examined': 2, 'eligible': 2, 'skipped': 0,
        'false_successes_corrected': 1, 'writes': 0,
    }
    assert collection.rows == original

    applied = migrate(collection, apply=True)
    assert applied['false_successes_corrected'] == 1 and applied['writes'] == 2
    assert collection.rows[0]['correct'] is False
    assert collection.rows[0]['score_method'] == 'tamil_text_similarity_v2'
    assert collection.rows[1]['correct'] is True
    assert collection.rows[2] == original[2]
    assert migrate(collection, apply=True)['writes'] == 0
