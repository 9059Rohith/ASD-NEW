import { describe, expect, it, vi } from 'vitest'
import {
  LETTER_FLIGHT_ROUNDS,
  findNewlyCrossedLetters,
  speakCuteLetterSound,
} from './letterFlight'

describe('balloon letter flight', () => {
  it('provides all twelve Tamil vowels across three ordered rounds', () => {
    expect(LETTER_FLIGHT_ROUNDS).toHaveLength(3)
    for (const round of LETTER_FLIGHT_ROUNDS) {
      expect(round).toHaveLength(4)
      expect(round.map((gate) => gate.threshold)).toEqual([0.18, 0.38, 0.58, 0.78])
    }
    expect(LETTER_FLIGHT_ROUNDS.flat().map((gate) => gate.letter)).toEqual(['அ','ஆ','இ','ஈ','உ','ஊ','எ','ஏ','ஐ','ஒ','ஓ','ஔ'])
  })

  it('returns every uncrossed gate passed during one upward movement', () => {
    const crossed = findNewlyCrossedLetters({
      previousLevel: 0.2,
      currentLevel: 0.58,
      obstacles: LETTER_FLIGHT_ROUNDS[0],
      crossedIds: new Set(),
    })
    expect(crossed.map((gate) => gate.letter)).toEqual(['ஆ', 'இ'])
  })

  it('does not repeat gates or trigger sounds while the balloon falls', () => {
    const obstacles = LETTER_FLIGHT_ROUNDS[0]
    expect(findNewlyCrossedLetters({
      previousLevel: 0.8, currentLevel: 0.3, obstacles, crossedIds: new Set(),
    })).toEqual([])
    expect(findNewlyCrossedLetters({
      previousLevel: 0.2, currentLevel: 0.58, obstacles, crossedIds: new Set(['round-1-aa', 'round-1-i']),
    })).toEqual([])
  })

  it('speaks the hit letter with an available Tamil voice', () => {
    const speak = vi.fn()
    class Utterance { constructor(text) { this.text = text } }
    const scope = {
      SpeechSynthesisUtterance: Utterance,
      speechSynthesis: {
        cancel: vi.fn(),
        getVoices: () => [
          { name: 'Microsoft Ravi', lang: 'en-IN', localService: true },
          { name: 'Microsoft Valluvar', lang: 'ta-IN', localService: true },
        ],
        speak,
      },
    }

    expect(speakCuteLetterSound(scope, LETTER_FLIGHT_ROUNDS[0][0])).toBe(true)
    const utterance = speak.mock.calls[0][0]
    expect(utterance).toMatchObject({ text: 'அ', lang: 'ta-IN' })
    expect(utterance.voice.name).toBe('Microsoft Valluvar')
    expect(scope.speechSynthesis.cancel).toHaveBeenCalledOnce()
  })
})
