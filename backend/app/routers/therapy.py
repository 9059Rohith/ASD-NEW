"""Therapy lessons router."""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict
from ..utils.jwt_handler import get_current_user
from ..curriculum import TAMIL_LESSONS


router = APIRouter(prefix="/api/therapy", tags=["therapy"])


AVATAR_COACH_DEFAULTS = {
    "enabled": True,
    "engine": "livetalk-unity",
    "renderer": "web-fallback",
    "name": "Mitra",
    "voice": "en-IN",
    "package_path": "LiveTalk-Unity",
}


def _with_avatar_coach(lesson: Dict) -> Dict:
    """Attach the child-friendly LiveTalk coach contract to a lesson."""
    english = lesson.get("english", "this sound")
    return {
        **lesson,
        "avatar_coach": {
            **AVATAR_COACH_DEFAULTS,
            "intro": f"Let's learn {english} together!",
            "tip": lesson.get("tip", "Take your time and try again."),
            "success": "Great job! You did it!",
            "retry": "Nice try. Let's practice once more.",
        },
    }


# Lesson curriculum data
LEGACY_LESSONS = [
    {
        "id": 1,
        "type": "letter",
        "symbol": "அ",
        "english": "A",
        "phoneme": "a",
        "image": "/assets/letters/a.png",
        "audio": "/assets/sounds/a.mp3",
        "mouth": "/assets/animations/a_mouth.gif",
        "tip": "Open mouth wide like saying AH",
        "difficulty": 1
    },
    {
        "id": 2,
        "type": "letter",
        "symbol": "ஆ",
        "english": "AA",
        "phoneme": "aa",
        "image": "/assets/letters/aa.png",
        "audio": "/assets/sounds/aa.mp3",
        "mouth": "/assets/animations/aa_mouth.gif",
        "tip": "Hold the AH sound longer — AAAH",
        "difficulty": 1
    },
    {
        "id": 3,
        "type": "letter",
        "symbol": "ல",
        "english": "LA",
        "phoneme": "la",
        "image": "/assets/letters/la.png",
        "audio": "/assets/sounds/la.mp3",
        "mouth": "/assets/animations/la_mouth.gif",
        "tip": "Touch tongue to roof of mouth",
        "difficulty": 2
    },
    {
        "id": 4,
        "type": "letter",
        "symbol": "த",
        "english": "TA",
        "phoneme": "ta",
        "image": "/assets/letters/ta.png",
        "audio": "/assets/sounds/ta.mp3",
        "mouth": "/assets/animations/ta_mouth.gif",
        "tip": "Tap tongue just behind teeth",
        "difficulty": 2
    },
    {
        "id": 5,
        "type": "word",
        "symbol": "அம்மா",
        "english": "AMMA",
        "phoneme": "amma",
        "image": "/assets/words/amma.png",
        "audio": "/assets/sounds/amma.mp3",
        "mouth": "/assets/animations/amma_mouth.gif",
        "tip": "AH + close lips MM + open AA",
        "airflow": "low",
        "candleBlows": False,
        "difficulty": 3
    },
    {
        "id": 6,
        "type": "word",
        "symbol": "அப்பா",
        "english": "APPA",
        "phoneme": "appa",
        "image": "/assets/words/appa.png",
        "audio": "/assets/sounds/appa.mp3",
        "mouth": "/assets/animations/appa_mouth.gif",
        "tip": "AH + burst lips PP + open AA",
        "airflow": "high",
        "candleBlows": True,
        "difficulty": 3
    }
]

# The imported curriculum is the single source of truth.  The legacy constant
# remains temporarily readable for migration compatibility but is never served.
LESSONS = TAMIL_LESSONS


@router.get("/lessons", response_model=List[Dict])
async def get_lessons(current_user: dict = Depends(get_current_user)):
    """Get all available lessons."""
    return [_with_avatar_coach(lesson) for lesson in LESSONS]


@router.get("/lessons/{lesson_id}", response_model=Dict)
async def get_lesson(lesson_id: int, current_user: dict = Depends(get_current_user)):
    """Get specific lesson by ID."""
    for lesson in LESSONS:
        if lesson["id"] == lesson_id:
            return _with_avatar_coach(lesson)
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Lesson with ID {lesson_id} not found"
    )
