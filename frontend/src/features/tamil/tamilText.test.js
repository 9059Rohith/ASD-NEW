import { describe, expect, it } from 'vitest'
import { compareTamilText, normalizeTamilText } from './tamilText'

describe('Tamil text comparison', () => {
  it('canonicalizes Unicode and harmless whitespace and punctuation', () => {
    expect(normalizeTamilText('  கொ,  வா! ')).toBe(normalizeTamilText('கொ வா'))
    expect(compareTamilText('அம்மா வீட்டில் இருக்கிறார்.', 'அம்மா   வீட்டில் இருக்கிறார்!', 'sentence').correct).toBe(true)
  })
  it('retains meaningful vowel and virama differences', () => {
    expect(compareTamilText('க', 'க்', 'letter').correct).toBe(false)
    expect(compareTamilText('கா', 'க', 'letter').correct).toBe(false)
    expect(compareTamilText('மரம்', 'மறம்', 'word').correct).toBe(false)
  })
  it('returns an honest partial score without turning a mismatch into success', () => {
    const result = compareTamilText('அம்மா வீட்டில் இருக்கிறார்', 'அம்மா வீட்டில்', 'sentence')
    expect(result.correct).toBe(false)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
    expect(compareTamilText('அம்மா', '', 'word')).toMatchObject({ correct: false, score: 0 })
  })
  it('gives spelling variations partial feedback without accepting changed words', () => {
    const close = compareTamilText('நாய் ஓடுகிறது.', 'நாய் ஓடுகிரது', 'sentence')
    expect(close.correct).toBe(false)
    expect(close.editDistance).toBe(1)
    expect(close.score).toBeGreaterThanOrEqual(90)
    expect(compareTamilText('அம்மா, வா.', 'அம்மாவா', 'sentence').correct).toBe(false)
    expect(compareTamilText('அம்மா', 'அம்மா mother', 'word').correct).toBe(false)
    const changedWord = compareTamilText('அம்மா வீட்டில் இருக்கிறார்.', 'அப்பா வீட்டில் இருக்கிறார்.', 'sentence')
    expect(changedWord.score).toBeGreaterThan(90)
    expect(changedWord.correct).toBe(false)
  })
})
