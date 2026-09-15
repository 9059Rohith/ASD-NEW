// Internal Roman IDs remain stable for the trained model; learners see Tamil.
export const TAMIL_VOWEL_SYMBOLS = Object.freeze({
  a: 'அ', aa: 'ஆ', i: 'இ', ii: 'ஈ', u: 'உ', uu: 'ஊ',
  e: 'எ', ee: 'ஏ', ai: 'ஐ', o: 'ஒ', oo: 'ஓ', au: 'ஔ',
})
export const TAMIL_IDENTITY_ORDER = Object.freeze(['A', 'I', 'U', 'E', 'O'])
export function tamilVowel(identity, length = 'short') {
  const key = String(identity || '').toLowerCase()
  return TAMIL_VOWEL_SYMBOLS[length === 'long' ? key + key : key] || '—'
}
export function tamilLength(length) {
  return length === 'short' ? 'குறில்' : length === 'long' ? 'நெடில்' : '—'
}
export function tamilPair(identity) {
  return `${tamilVowel(identity)} / ${tamilVowel(identity, 'long')}`
}
