export function buildTrainingRoadmap(lessons) {
  if (!Array.isArray(lessons)) return []
  return lessons
    .filter((lesson) => Number.isInteger(lesson?.id) && lesson.id > 0 && String(lesson?.symbol || '').trim())
    .sort((left, right) => left.id - right.id)
    .map((lesson) => ({
      ...lesson,
      letter: lesson.symbol,
      roman: lesson.english,
      status: 'available',
      path: `/therapy/${lesson.id}`,
    }))
}
