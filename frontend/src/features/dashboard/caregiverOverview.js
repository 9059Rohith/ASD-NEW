import { TAMIL_TRAINING_ITEMS } from '../training/tamilCurriculum'

const TARGETS_BY_LESSON = Object.fromEntries(TAMIL_TRAINING_ITEMS.map(
  (lesson) => [lesson.id, { symbol: lesson.symbol, label: lesson.english }],
))


export function buildCaregiverOverview({ progress, user }) {
  const rows = Array.isArray(progress?.progress_by_lesson) ? progress.progress_by_lesson : []
  const targets = rows
    .map((row) => ({
      lessonId: row.lesson_id,
      symbol: TARGETS_BY_LESSON[row.lesson_id]?.symbol || row.phoneme || `Lesson ${row.lesson_id}`,
      label: TARGETS_BY_LESSON[row.lesson_id]?.label || row.phoneme || 'Tamil target',
      accuracy: Math.round(row.best_accuracy || 0),
      attempts: row.attempts || 0,
    }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 3)

  const chart = Array.isArray(progress?.chart_data)
    ? progress.chart_data.map((point) => ({ ...point, accuracy: Math.round(point.accuracy || 0) }))
    : []

  return {
    hasData: targets.length > 0 || chart.length > 0,
    overallAccuracy: Math.round(progress?.avg_accuracy || 0),
    sessions: progress?.total_sessions ?? user?.total_sessions ?? 0,
    targets,
    chart,
  }
}
