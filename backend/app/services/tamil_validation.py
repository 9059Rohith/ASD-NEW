"""Centralized Tamil text normalization and bounded lesson matching."""
from __future__ import annotations

import unicodedata


def normalize_tamil_text(value: str) -> str:
    return normalize_written_tamil(value)


def normalize_written_tamil(value: str) -> str:
    """Ignore spacing and punctuation noise without joining distinct words."""
    normalized = unicodedata.normalize('NFC', str(value or ''))
    separated = ''.join(' ' if unicodedata.category(character).startswith(('P', 'S')) else character
                        for character in normalized)
    return ' '.join(separated.split())


def _edit_distance(expected: str, actual: str) -> int:
    previous = list(range(len(actual) + 1))
    for row, expected_character in enumerate(expected, 1):
        current = [row]
        for column, actual_character in enumerate(actual, 1):
            current.append(min(current[-1] + 1, previous[column] + 1,
                               previous[column - 1] + (expected_character != actual_character)))
        previous = current
    return previous[-1]


def compare_tamil_text(expected: str, recognized: str, *, kind: str) -> dict:
    """Require exact normalized text for success; retain similarity for feedback.

    A one- or two-character change can replace a Tamil content word with a
    different word, so edit distance must not grant lesson completion.
    """
    expected_normalized = normalize_tamil_text(expected)
    recognized_normalized = normalize_tamil_text(recognized)
    if not expected_normalized or not recognized_normalized:
        distance = max(len(expected_normalized), len(recognized_normalized))
        return {'correct': False, 'similarity': 0., 'edit_distance': distance,
                'expected_normalized': expected_normalized, 'recognized_normalized': recognized_normalized}
    distance = _edit_distance(expected_normalized, recognized_normalized)
    similarity = max(0., 1 - distance / max(len(expected_normalized), len(recognized_normalized)))
    correct = distance == 0
    return {'correct': correct, 'similarity': round(similarity, 4), 'edit_distance': distance,
            'expected_normalized': expected_normalized, 'recognized_normalized': recognized_normalized}


def grade_tamil_transcript(item: dict, recognized: str) -> dict:
    """Grade complete course text from actual Tamil ASR output, never a prompt."""
    comparison = compare_tamil_text(item['text'], recognized, kind=item['kind'])
    correct = comparison['correct']
    return {
        'accuracy': round(comparison['similarity'] * 100, 2), 'scorable': True,
        'phoneme_match': correct, 'correct': correct,
        'recognized_text': recognized.strip(), 'text_similarity': comparison['similarity'],
        'edit_distance': comparison['edit_distance'], 'confidence': None,
        'validation_status': 'validated' if correct else 'not_matched',
        'validation_source': 'server_indicconformer', 'score_method': 'tamil_text_similarity_v2',
        'feedback': ('The complete Tamil target was recognized. Well done!' if correct else
                     'The recognized Tamil was close but not exact. Check each word and try again.'
                     if comparison['similarity'] >= .9 else
                     'The recognized Tamil did not match the complete target. Listen and try again.'),
    }
