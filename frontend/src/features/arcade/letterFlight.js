import { speakCharacter } from '../characters/characterVoice'

const ROUND_LETTERS = Object.freeze([
  Object.freeze([['அ', 'a'], ['ஆ', 'aa'], ['இ', 'i'], ['ஈ', 'ii']]),
  Object.freeze([['உ', 'u'], ['ஊ', 'uu'], ['எ', 'e'], ['ஏ', 'ee']]),
  Object.freeze([['ஐ', 'ai'], ['ஒ', 'o'], ['ஓ', 'oo'], ['ஔ', 'au']]),
])

const THRESHOLDS = Object.freeze([0.18, 0.38, 0.58, 0.78])

export const LETTER_FLIGHT_ROUNDS = Object.freeze(ROUND_LETTERS.map((letters, roundIndex) => (
  Object.freeze(letters.map(([letter, sound], gateIndex) => Object.freeze({
    id: `round-${roundIndex + 1}-${sound}`,
    letter,
    sound,
    threshold: THRESHOLDS[gateIndex],
  })))
)))

export function findNewlyCrossedLetters({ previousLevel, currentLevel, obstacles, crossedIds }) {
  const previous = Math.max(0, Math.min(1, Number(previousLevel) || 0))
  const current = Math.max(0, Math.min(1, Number(currentLevel) || 0))
  if (current <= previous) return []
  const completed = crossedIds instanceof Set ? crossedIds : new Set(crossedIds || [])
  return obstacles.filter((obstacle) => (
    !completed.has(obstacle.id)
    && obstacle.threshold > previous
    && obstacle.threshold <= current
  ))
}

export function speakCuteLetterSound(scope, obstacle) {
  if (!scope?.speechSynthesis || !scope?.SpeechSynthesisUtterance || !obstacle?.letter) return false
  return speakCharacter(obstacle.letter, {
    synthesis: scope.speechSynthesis,
    UtteranceCtor: scope.SpeechSynthesisUtterance,
    profileId: 'kaviTamil',
    language: 'ta-IN',
    guided: true,
  })
}
