import { describe, expect, it } from 'vitest'
import { loginDestination } from './loginDestination'

describe('return to intended learning activity', () => {
  it('preserves an authenticated learner target', () => {
    expect(loginDestination('user', '/practice?target=aa')).toBe('/practice?target=aa')
    expect(loginDestination('user', '/games/vowels/match-sound')).toBe('/games/vowels/match-sound')
    expect(loginDestination('user', '/tamil?kind=sentence')).toBe('/tamil?kind=sentence')
    expect(loginDestination('user', '/tamil/practice/word-amma')).toBe('/tamil/practice/word-amma')
  })
  it('rejects external, admin, and incompatible role destinations', () => {
    expect(loginDestination('user', '//example.com')).toBe('/dashboard')
    expect(loginDestination('user', 'https://example.com')).toBe('/dashboard')
    expect(loginDestination('user', '/admin')).toBe('/dashboard')
    expect(loginDestination('therapist', '/practice')).toBe('/therapist')
  })
})
