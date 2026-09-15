"""Training rewards must agree with the vowel identity-and-length outcome."""
from app.services.reward_engine import reward_engine


def test_wrong_vowel_length_cannot_complete_lesson_from_high_practice_score():
    result = {'score_method': 'real-data-independent-vowel-v1', 'accuracy': 76,
              'scorable': True, 'phoneme_match': False,
              'vowel_analysis': {'identity_match': True, 'length_match': False}}
    assert reward_engine.calculate_evaluation_stars(result) == 0


def test_matching_vowel_and_legacy_word_keep_earned_stars():
    assert reward_engine.calculate_evaluation_stars({'score_method': 'real-data-independent-vowel-v1',
        'accuracy': 95, 'scorable': True, 'phoneme_match': True}) == 3
    assert reward_engine.calculate_evaluation_stars({'score_method': 'phoneme_edit_accuracy_v1',
        'accuracy': 76, 'scorable': True, 'phoneme_match': False}) == 2
