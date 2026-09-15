import { describe, expect, it } from 'vitest'
import { TAMIL_TRAINING_ITEMS, TAMIL_VOWELS, TAMIL_WORDS } from './tamilCurriculum'

describe('shared Tamil curriculum', () => {
  it('matches the backend 16-lesson therapy IDs without phantom sentences', () => {
    expect(TAMIL_VOWELS.map((item) => item.symbol)).toEqual(['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ'])
    expect(TAMIL_VOWELS.map((item) => item.roman)).toEqual(['a', 'aa', 'i', 'ee', 'u', 'oo', 'e', 'ē', 'ai', 'o', 'ō', 'au'])
    expect(TAMIL_WORDS.map((item) => item.symbol)).toEqual(['அம்மா', 'அப்பா', 'மரம்', 'பழம்'])
    expect(TAMIL_TRAINING_ITEMS).toHaveLength(16)
    expect(TAMIL_TRAINING_ITEMS.map((item) => item.id)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1))
    expect(TAMIL_TRAINING_ITEMS[15]).toMatchObject({ id: 16, symbol: 'பழம்', phoneme: 'pazham' })
  })
  it('teaches Tamil vowel classes and real Tamil example sentences', () => {
    expect(TAMIL_VOWELS.filter(item => item.vowelClass === 'குறில்')).toHaveLength(5)
    expect(TAMIL_VOWELS.filter(item => item.vowelClass === 'நெடில்')).toHaveLength(7)
    expect(TAMIL_TRAINING_ITEMS.every(item => /[\u0B80-\u0BFF]/.test(item.sentence) && !/[A-Za-z]/.test(item.sentence))).toBe(true)
    expect(TAMIL_WORDS[3].sentence).toBe('இது பழம்.')
  })
})
