import { describe, expect, it } from 'vitest'

import { buildEvidenceRows, reviewSignalFor } from './therapistReview'


describe('therapist review evidence', () => {
  it('sorts the lowest-accuracy target first without inventing evidence', () => {
    const rows = buildEvidenceRows([
      { phoneme: 'க', accuracy: 84.4, attempts: 5 },
      { phoneme: 'ழ', accuracy: 46.2, attempts: 3 },
    ])

    expect(rows).toEqual([
      { phoneme: 'ழ', accuracy: 46, attempts: 3, signal: 'Review next' },
      { phoneme: 'க', accuracy: 84, attempts: 5, signal: 'Stable' },
    ])
  })

  it('uses calm, action-oriented review signals', () => {
    expect(reviewSignalFor(39)).toBe('Review next')
    expect(reviewSignalFor(65)).toBe('Developing')
    expect(reviewSignalFor(88)).toBe('Stable')
  })
})
