import { describe, expect, it, vi } from 'vitest'
import { TAMIL_KINDS, TAMIL_VOWEL_ORDER, createTamilRequestId, createTamilVoicePlayer, hasTamilScore, itemsForTamilKind, normalizeTamilKind, phonemeText, selectTamilVoice, tamilLengthLabel, tamilPracticeHref } from './tamilLearning'

describe('Tamil learning presentation', () => {
  it('keeps all twelve exact Tamil vowels in canonical Tamil order', () => {
    expect(TAMIL_VOWEL_ORDER).toEqual(['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ'])
    expect(TAMIL_VOWEL_ORDER.at(-1)).toBe('\u0b94')
    const source = [{ kind: 'vowel', text: 'ஔ' }, { kind: 'word', text: 'அம்மா' }, { kind: 'vowel', text: 'அ' }, { kind: 'vowel', text: 'ஐ' }]
    expect(itemsForTamilKind(source, 'vowel').map(item => item.text)).toEqual(['அ', 'ஐ', 'ஔ'])
    expect(source[0].text).toBe('ஔ')
  })
  it('keeps every lesson inside one sequential Tamil practice journey', () => {
    expect(tamilPracticeHref({ kind: 'vowel', id: 'letter-aa', studio_target: 'aa' })).toBe('/tamil/practice/letter-aa')
    expect(tamilPracticeHref({ kind: 'vowel', id: 'letter-ai' })).toBe('/tamil/practice/letter-ai')
    expect(tamilPracticeHref({ kind: 'vowel', id: 'letter-au' })).toBe('/tamil/practice/letter-au')
    expect(tamilPracticeHref({ kind: 'word', id: 'word-amma' })).toBe('/tamil/practice/word-amma')
    expect(tamilPracticeHref({ kind: 'sentence', id: 'sentence-amma-veettil' })).toBe('/tamil/practice/sentence-amma-veettil')
  })
  it('keeps grammatical length labels separate from acoustic measurements', () => {
    expect(tamilLengthLabel('kuril')).toBe('குறில்')
    expect(tamilLengthLabel('nedil')).toBe('நெடில்')
    expect(tamilLengthLabel('long')).toBe('')
    expect(tamilLengthLabel(7000)).toBe('')
  })
  it('includes 31 basic symbols, 216 uyirmei, words and sentences', () => {
    expect(TAMIL_KINDS.map(kind => [kind.level, kind.label, kind.total])).toEqual([
      [1, 'உயிரெழுத்துக்கள்', 12],
      [2, 'மெய்யெழுத்துக்கள்', 18],
      [3, 'ஆய்த எழுத்து', 1],
      [4, 'உயிர்மெய்யெழுத்துக்கள்', 216],
      [5, 'சொற்கள்', 10],
      [6, 'வாக்கியங்கள்', 8],
    ])
    expect(normalizeTamilKind('sentence')).toBe('sentence')
    expect(normalizeTamilKind('english')).toBe('vowel')
  })
  it('groups uyirmei by its parent consonant without dropping vowels', () => {
    const items = [
      { kind: 'uyirmei', id: 'uyirmei-ka-a', consonant_id: 'consonant-ka', vowel_target: 'a', text: 'க' },
      { kind: 'uyirmei', id: 'uyirmei-nga-a', consonant_id: 'consonant-nga', vowel_target: 'a', text: 'ங' },
      { kind: 'uyirmei', id: 'uyirmei-ka-aa', consonant_id: 'consonant-ka', vowel_target: 'aa', text: 'கா' },
    ]
    expect(itemsForTamilKind(items, 'uyirmei', 'consonant-ka').map(item => item.text)).toEqual(['க', 'கா'])
    expect(itemsForTamilKind(items, 'uyirmei').map(item => item.text)).toEqual(['க', 'ங', 'கா'])
  })
  it('distinguishes a measured zero from an unscored attempt and preserves detected phonemes', () => {
    expect(hasTamilScore({ scorable: true, accuracy: 0 })).toBe(true)
    expect(hasTamilScore({ scorable: false, accuracy: 0 })).toBe(false)
    expect(hasTamilScore({ scorable: true, accuracy: null })).toBe(false)
    expect(phonemeText(['a', 'm', 'm', 'aː'])).toBe('a m m aː')
    expect(phonemeText([])).toBe('—')
  })
  it('still creates a valid UUID on browsers without crypto.randomUUID', () => {
    expect(createTamilRequestId({ getRandomValues: bytes => bytes.fill(0) })).toBe('00000000-0000-4000-8000-000000000000')
    expect(createTamilRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('Tamil-only example voice', () => {
  it('never selects an English voice even when its name mentions Tamil', () => {
    expect(selectTamilVoice([{ name: 'Tamil reader', lang: 'en-IN' }])).toBeNull()
    expect(selectTamilVoice([{ lang: 'en-US' }, { lang: 'ta-IN', name: 'Tamil' }])?.name).toBe('Tamil')
    expect(selectTamilVoice([{ lang: 'ta-SG', localService: false }, { lang: 'ta-IN', localService: true }])?.lang).toBe('ta-IN')
  })
  it('reports unavailable Tamil without speaking a fallback', () => {
    const speak = vi.fn()
    const environment = { speechSynthesis: { getVoices: () => [{ lang: 'en-US' }], speak, cancel: vi.fn() }, SpeechSynthesisUtterance: class {} }
    expect(createTamilVoicePlayer(environment).play('அம்மா')).toBe(false)
    expect(speak).not.toHaveBeenCalled()
  })
  it('uses the Tamil text and voice, then ignores playback callbacks after cancellation', () => {
    const speak = vi.fn()
    const cancel = vi.fn()
    const voice = { lang: 'ta-IN', localService: true }
    const environment = { speechSynthesis: { getVoices: () => [voice], speak, cancel }, SpeechSynthesisUtterance: class { constructor(text) { this.text = text } } }
    const player = createTamilVoicePlayer(environment)
    const ended = vi.fn()
    expect(player.play('அம்மா, வா.', { onEnd: ended })).toBe(true)
    expect(speak.mock.calls[0][0]).toMatchObject({ text: 'அம்மா, வா.', lang: 'ta-IN', voice })
    player.stop()
    speak.mock.calls[0][0].onend()
    expect(cancel).toHaveBeenCalledOnce()
    expect(ended).not.toHaveBeenCalled()
  })
})
