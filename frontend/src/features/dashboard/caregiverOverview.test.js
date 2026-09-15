import { describe, expect, it } from 'vitest'

import { buildCaregiverOverview } from './caregiverOverview'


describe('caregiver overview', () => {
  it('builds target evidence from real progress and keeps the weakest first', () => {
    const overview = buildCaregiverOverview({
      user: { total_sessions: 12 },
      progress: {
        avg_accuracy: 74,
        chart_data: [{ date: '08/30', accuracy: 74 }],
        progress_by_lesson: [
          { lesson_id: 1, best_accuracy: 88, attempts: 4 },
          { lesson_id: 13, best_accuracy: 64, attempts: 5 },
          { lesson_id: 2, best_accuracy: 76, attempts: 3 },
        ],
      },
    })

    expect(overview.overallAccuracy).toBe(74)
    expect(overview.sessions).toBe(12)
    expect(overview.targets.map((target) => target.symbol)).toEqual(['அம்மா', 'ஆ', 'அ'])
    expect(overview.targets[0].accuracy).toBe(64)
  })

  it('returns honest empty states when no evidence exists', () => {
    const overview = buildCaregiverOverview({ user: {}, progress: undefined })

    expect(overview.hasData).toBe(false)
    expect(overview.targets).toEqual([])
    expect(overview.chart).toEqual([])
  })
})
