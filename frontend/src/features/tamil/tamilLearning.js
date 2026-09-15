export const TAMIL_VOWEL_ORDER = Object.freeze(['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ'])
export const TAMIL_KINDS = Object.freeze([
  { id: 'vowel', level: 1, total: 12, label: 'உயிரெழுத்துக்கள்', english: 'Vowels', description: 'பன்னிரண்டு உயிரெழுத்துகளை அறிந்து, ஒவ்வொன்றாகப் பழகலாம்.', explanation: 'Explore all twelve Tamil vowels, in Tamil alphabetical order.' },
  { id: 'consonant', level: 2, total: 18, label: 'மெய்யெழுத்துக்கள்', english: 'Consonants', description: 'பதினெட்டு மெய்யெழுத்துகளை ஒவ்வொன்றாக அறியலாம்.', explanation: 'Explore the eighteen Tamil consonants.' },
  { id: 'aytham', level: 3, total: 1, label: 'ஆய்த எழுத்து', english: 'Aytham', description: 'ஃ என்ற தனி எழுத்தை அறிந்து எழுதிப் பழகலாம்.', explanation: 'Recognize and write the separate Tamil aytham symbol.' },
  { id: 'uyirmei', level: 4, total: 216, label: 'உயிர்மெய்யெழுத்துக்கள்', english: 'Combined letters', description: 'ஒவ்வொரு மெய்யுடனும் பன்னிரண்டு உயிர்களை இணைத்துப் பழகலாம்.', explanation: 'Study all 216 consonant–vowel combinations, twelve at a time.' },
  { id: 'word', level: 5, total: 10, label: 'சொற்கள்', english: 'Words', description: 'பத்து எளிய சொற்களை முழுமையாகச் சொல்லிப் பழகலாம்.', explanation: 'Practise ten complete beginner words, one at a time.' },
  { id: 'sentence', level: 6, total: 8, label: 'வாக்கியங்கள்', english: 'Sentences', description: 'எட்டு சிறிய வாக்கியங்களை இயல்பாகச் சொல்லிப் பழகலாம்.', explanation: 'Bring the words together in eight complete Tamil sentences.' },
])
export const TAMIL_SECTIONS = Object.freeze([
  { id: 'phonemes', label: 'எழுத்துகள்', english: 'Phonemes / Letters', firstKind: 'vowel' },
  { id: 'words', label: 'சொற்கள்', english: 'Words', firstKind: 'word' },
  { id: 'sentences', label: 'வாக்கியங்கள்', english: 'Sentences', firstKind: 'sentence' },
])
export function sectionForTamilKind(kind) {
  return kind === 'word' ? 'words' : kind === 'sentence' ? 'sentences' : 'phonemes'
}
export function normalizeTamilKind(kind) { return TAMIL_KINDS.some(item => item.id === kind) ? kind : 'vowel' }
export function tamilPracticeHref(item) {
  return `/tamil/practice/${encodeURIComponent(item.id)}`
}
export function itemsForTamilKind(items, kind, consonantId = null) {
  const selected = items.filter(item => item.kind === kind && (kind !== 'uyirmei' || !consonantId || item.consonant_id === consonantId))
  return selected.sort((a, b) => {
    if (Number.isFinite(a.display_order) && Number.isFinite(b.display_order)) return a.display_order - b.display_order
    if (kind !== 'vowel') return 0
    const position = item => { const index = TAMIL_VOWEL_ORDER.indexOf(item.text.normalize('NFC')); return index === -1 ? 99 : index }
    return position(a) - position(b)
  })
}
export function tamilLengthLabel(label) { return label === 'kuril' ? 'குறில்' : label === 'nedil' ? 'நெடில்' : '' }
export function hasTamilScore(result) { return result?.scorable === true && Number.isFinite(result.accuracy) }
export function phonemeText(value) { return Array.isArray(value) && value.length ? value.join(' ') : '—' }
export function createTamilRequestId(cryptoProvider = globalThis.crypto) {
  if (cryptoProvider?.randomUUID) return cryptoProvider.randomUUID()
  const bytes = new Uint8Array(16)
  if (cryptoProvider?.getRandomValues) cryptoProvider.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export function selectTamilVoice(voices = []) {
  const tamil = voices.filter(voice => /^ta(?:[-_]|$)/i.test(voice.lang || ''))
  return tamil.find(voice => voice.localService) || tamil[0] || null
}

/** Only a voice explicitly labelled Tamil may pronounce Tamil examples. */
export function createTamilVoicePlayer(environment = globalThis) {
  let generation = 0
  let speaking = false
  return {
    stop() {
      generation += 1
      if (speaking) environment.speechSynthesis?.cancel()
      speaking = false
    },
    play(text, { onStart = () => {}, onEnd = () => {}, onError = () => {} } = {}) {
      this.stop()
      const voice = selectTamilVoice(environment.speechSynthesis?.getVoices?.() || [])
      if (!voice || !environment.SpeechSynthesisUtterance) return false
      const current = generation
      const utterance = new environment.SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang
      utterance.rate = .85
      utterance.onstart = () => { if (current === generation) onStart() }
      utterance.onend = () => { if (current === generation) { speaking = false; onEnd() } }
      utterance.onerror = event => { if (current === generation) { speaking = false; onError(event.error || 'unavailable') } }
      speaking = true
      try { environment.speechSynthesis.speak(utterance) } catch { speaking = false; onError('unavailable'); return false }
      return true
    },
  }
}
