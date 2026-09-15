import { describe, expect, it } from 'vitest'
import { isSuccessfulResult } from './evaluationOutcome'

describe('training evaluation outcome', () => {
  it('does not pass a wrong vowel length even if the educational score is high', () => {
    expect(isSuccessfulResult({ score_method: 'real-data-independent-vowel-v1', scorable: true,
      accuracy: 76, phoneme_match: false, vowel_analysis: { identity_match: true, length_match: false } })).toBe(false)
  })

  it('passes only an assessed matching vowel and rejects unscorable audio', () => {
    expect(isSuccessfulResult({ score_method: 'real-data-independent-vowel-v1', scorable: true,
      accuracy: 82, phoneme_match: true })).toBe(true)
    expect(isSuccessfulResult({ score_method: 'real-data-independent-vowel-v1', scorable: false,
      accuracy: 99, phoneme_match: true })).toBe(false)
  })

  it('keeps the existing word threshold and requires an assessed diphthong match', () => {
    expect(isSuccessfulResult({ accuracy: 75, scorable: true, phoneme_match: false })).toBe(true)
    expect(isSuccessfulResult({ score_method: 'diphthong_identity_match_v1', accuracy: 100,
      scorable: true, phoneme_match: false })).toBe(false)
  })
})
