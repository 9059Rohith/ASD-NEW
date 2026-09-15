import { describe, expect, it } from 'vitest'
import { TAMIL_VOWEL_SYMBOLS, TAMIL_IDENTITY_ORDER, tamilVowel, tamilLength, tamilPair } from './tamilLabels'

describe('Tamil learner labels preserve acoustic IDs', () => {
  it('contains twelve distinct Unicode Tamil vowels including real au', () => {
    expect(Object.values(TAMIL_VOWEL_SYMBOLS).join(' ')).toBe('அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ')
    expect(TAMIL_VOWEL_SYMBOLS.au.codePointAt(0)).toBe(0x0b94)
  })
  it('keeps Tamil i/e/u sounds distinct from English letter names', () => {
    expect(tamilVowel('I', 'long')).toBe('ஈ')
    expect(tamilVowel('E', 'long')).toBe('ஏ')
    expect(tamilVowel('U', 'long')).toBe('ஊ')
    expect(TAMIL_IDENTITY_ORDER.map(tamilPair)).toEqual(['அ / ஆ', 'இ / ஈ', 'உ / ஊ', 'எ / ஏ', 'ஒ / ஓ'])
    expect(tamilLength('short')).toBe('குறில்')
    expect(tamilLength('long')).toBe('நெடில்')
  })
})
