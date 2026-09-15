"""Contract tests for the complete Tamil therapy curriculum."""

from app.routers.evaluation import validate_lesson_target
from app.routers.therapy import LESSONS


def test_curriculum_contains_all_vowels_and_four_words_in_order():
    assert [lesson["symbol"] for lesson in LESSONS] == [
        "அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ",
        "அம்மா", "அப்பா", "மரம்", "பழம்",
    ]
    assert [lesson["id"] for lesson in LESSONS] == list(range(1, 17))
    assert [lesson["english"] for lesson in LESSONS] == [
        "A", "AA", "I", "II", "U", "UU", "E", "EE", "AI", "O", "OO", "AU",
        "AMMA", "APPA", "MARAM", "PAZHAM",
    ]
    assert [lesson["type"] for lesson in LESSONS] == (["letter"] * 12) + (["word"] * 4)
    assert all(lesson["voice_language"] == "ta-IN" for lesson in LESSONS)
    assert all(lesson["voice_key"] == f"lesson_{lesson['id']}" for lesson in LESSONS)


def test_every_curriculum_target_is_accepted_only_for_its_own_lesson():
    for lesson in LESSONS:
        assert validate_lesson_target(lesson["id"], lesson["phoneme"].upper()) == lesson["phoneme"]

    try:
        validate_lesson_target(16, "a")
    except ValueError as exc:
        assert str(exc) == "Lesson and target phoneme do not match"
    else:
        raise AssertionError("a target from a different lesson was accepted")
