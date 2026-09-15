"""Canonical Tamil speech-therapy curriculum shared by API boundaries."""


def _letter(lesson_id: int, symbol: str, english: str, phoneme: str, tip: str) -> dict:
    return {
        "id": lesson_id,
        "type": "letter",
        "symbol": symbol,
        "english": english,
        "phoneme": phoneme,
        "image": f"/assets/letters/{phoneme}.png",
        "audio": f"/assets/sounds/{phoneme}.mp3",
        "mouth": f"/assets/animations/{phoneme}_mouth.gif",
        "tip": tip,
        "difficulty": 1 if lesson_id <= 6 else 2,
        "voice_key": f"lesson_{lesson_id}",
        "voice_language": "ta-IN",
    }


def _word(lesson_id: int, symbol: str, english: str, phoneme: str, tip: str) -> dict:
    return {
        "id": lesson_id,
        "type": "word",
        "symbol": symbol,
        "english": english,
        "phoneme": phoneme,
        "image": f"/assets/words/{phoneme}.png",
        "audio": f"/assets/sounds/{phoneme}.mp3",
        "mouth": f"/assets/animations/{phoneme}_mouth.gif",
        "tip": tip,
        "airflow": "low",
        "candleBlows": False,
        "difficulty": 3,
        "voice_key": f"lesson_{lesson_id}",
        "voice_language": "ta-IN",
    }


TAMIL_LESSONS = [
    _letter(1, "அ", "A", "a", "Open your mouth gently for the short அ sound"),
    _letter(2, "ஆ", "AA", "aa", "Hold the open ஆ sound a little longer"),
    _letter(3, "இ", "I", "i", "Smile slightly and say the short இ sound"),
    _letter(4, "ஈ", "II", "ii", "Stretch the long ஈ sound smoothly"),
    _letter(5, "உ", "U", "u", "Round your lips gently for the short உ sound"),
    _letter(6, "ஊ", "UU", "uu", "Hold the rounded ஊ sound a little longer"),
    _letter(7, "எ", "E", "e", "Keep your jaw relaxed for the short எ sound"),
    _letter(8, "ஏ", "EE", "ee", "Stretch the clear ஏ sound smoothly"),
    _letter(9, "ஐ", "AI", "ai", "Glide clearly through the ஐ sound"),
    _letter(10, "ஒ", "O", "o", "Round your lips for the short ஒ sound"),
    _letter(11, "ஓ", "OO", "oo", "Hold the rounded ஓ sound smoothly"),
    _letter(12, "ஔ", "AU", "au", "Open and round your mouth through the ஔ sound"),
    _word(13, "அம்மா", "AMMA", "amma", "Say அம், then finish with a long மா"),
    _word(14, "அப்பா", "APPA", "appa", "Say அப், then finish with a long பா"),
    _word(15, "மரம்", "MARAM", "maram", "Say ம-ரம் slowly, then join the sounds"),
    _word(16, "பழம்", "PAZHAM", "pazham", "Curl the tongue gently for the ழ sound in பழம்"),
]

LESSON_PHONEMES = {lesson["id"]: lesson["phoneme"] for lesson in TAMIL_LESSONS}

