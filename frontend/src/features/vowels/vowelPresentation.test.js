import { describe, expect, it } from 'vitest'
import { canRetryChallenge, challengeMatch, feedbackText, isScorable, resultMood, VOWEL_MODES } from './vowelPresentation'

describe('vowel learning presentation rules', () => {
  it('exposes six distinct selectable games', () => {
    expect(VOWEL_MODES.map(item => item.id)).toEqual(['vowel-catch', 'short-or-long', 'match-sound', 'pippin-challenge', 'speed-round', 'vowel-tower'])
    expect(new Set(VOWEL_MODES.map(item => item.instruction)).size).toBe(6)
  })
  it('keeps listening and abstentions out of pronunciation scores', () => {
    expect(isScorable({ kind: 'listening', correct: true, accuracy: null, scorable: false })).toBe(false)
    expect(isScorable({ accuracy: 0, scorable: false })).toBe(false)
    expect(isScorable({ accuracy: null, scorable: true })).toBe(false)
    expect(isScorable({ accuracy: 0, scorable: true })).toBe(true)
  })
  it('preserves single-attempt evaluations and listening answers while allowing practice retries', () => {
    expect(canRetryChallenge('practice')).toBe(true)
    expect(canRetryChallenge('vowel-tower')).toBe(true)
    expect(canRetryChallenge('evaluate')).toBe(false)
    expect(canRetryChallenge('speed-round')).toBe(false)
    expect(canRetryChallenge('match-sound')).toBe(false)
  })
  it('requires both identity and length for a capture or tower level', () => {
    expect(challengeMatch({ vowel_analysis: { identity_match: true, length_match: true } })).toBe(true)
    expect(challengeMatch({ vowel_analysis: { identity_match: true, length_match: false } })).toBe(false)
    expect(challengeMatch({ vowel_analysis: { matches: { identity: true, length: false } } })).toBe(false)
    expect(challengeMatch({ vowel_analysis: { matches: { identity: true, length: true } } })).toBe(true)
    expect(challengeMatch({})).toBe(false)
  })
  it('uses supportive Pippin states for errors and low confidence', () => {
    expect(resultMood('RECORDING')).toBe('listening')
    expect(resultMood('PROCESSING')).toBe('thinking')
    expect(resultMood('RETRY', { scorable: false })).toBe('encouraging')
    expect(resultMood('RESULT', { scorable: true, accuracy: 34 })).toBe('encouraging')
    expect(resultMood('RESULT', { scorable: true, accuracy: 95 })).toBe('excited')
  })
  it('uses server feedback without inventing measurements', () => {
    expect(feedbackText({ feedback: 'Try holding the vowel a little longer.' })).toBe('Try holding the vowel a little longer.')
    expect(feedbackText({ feedback: [{ message: 'Find a quiet room.' }, 'Try again.'] })).toBe('Find a quiet room. Try again.')
  })
  it('distinguishes perfect rewards and follows the server success decision', () => {
    expect(resultMood('RESULT', { scorable: true, accuracy: 100, celebration: 'perfect', success: true })).toBe('celebrating')
    expect(resultMood('RESULT', { scorable: true, accuracy: 65, success: false })).toBe('encouraging')
  })
})
