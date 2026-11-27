"""Tests for the training-slide avatar coach contract."""

import asyncio

from app.routers.therapy import get_lesson, get_lessons


def test_lessons_include_browser_avatar_coach_configuration():
    lessons = asyncio.run(get_lessons({}))
    assert lessons
    assert all(lesson["avatar_coach"]["engine"] == "web-fallback" for lesson in lessons)
    assert all(lesson["avatar_coach"]["enabled"] is True for lesson in lessons)
    assert all("package_path" not in lesson["avatar_coach"] for lesson in lessons)


def test_lesson_payload_exposes_avatar_coach_script():
    lesson = asyncio.run(get_lesson(3, {}))
    assert lesson["avatar_coach"]["intro"]
    assert lesson["avatar_coach"]["tip"] == lesson["tip"]
