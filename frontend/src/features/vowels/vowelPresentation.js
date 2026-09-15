export const VOWEL_MODES = Object.freeze([
  { id: 'vowel-catch', title: 'Vowel Catch', description: 'Say the sound. Catch a vowel.', instruction: 'Catch this vowel by saying it clearly.' },
  { id: 'short-or-long', title: 'Short or Long?', description: 'A little sound. A longer sound.', instruction: 'Keep your vowel brief or hold it gently to match the length.' },
  { id: 'match-sound', title: 'Match the Sound', description: 'Listen closely. Find its match.', instruction: 'Listen first, then choose the vowel and its length.' },
  { id: 'pippin-challenge', title: 'Pippin Challenge', description: 'Your friendly coach has a challenge.', instruction: 'Listen to Pippin’s prompt, then give it a try.' },
  { id: 'speed-round', title: 'Speed Round', description: 'Ten sounds, at your own pace.', instruction: 'Ten sounds. Take your time between recordings.' },
  { id: 'vowel-tower', title: 'Vowel Tower', description: 'Build confidence, one sound at a time.', instruction: 'Each matching vowel adds a level to your tower.' },
])

export function canRetryChallenge(mode) { return !['evaluation', 'evaluate', 'speed-round', 'match-sound'].includes(mode) }
export function isScorable(result) { return result?.scorable === true && Number.isFinite(result?.accuracy) }
export function isSuccessful(result) { return isScorable(result) && (typeof result.success === 'boolean' ? result.success : result.accuracy > 50) }
export function resultMood(state, result) {
  if (state === 'RECORDING') return 'listening'
  if (state === 'PROCESSING' || state === 'GETTING_READY') return 'thinking'
  if (state === 'COMPLETED') return 'celebrating'
  if (!result) return state === 'ERROR' ? 'encouraging' : 'idle'
  if (result.kind === 'listening') return result.correct ? 'happy' : 'encouraging'
  if (!isSuccessful(result)) return 'encouraging'
  if (result.celebration === 'perfect' || result.accuracy === 100) return 'celebrating'
  return result.celebration === 'excellent' || result.accuracy >= 90 ? 'excited' : 'happy'
}
export function feedbackText(result) {
  if (typeof result?.feedback === 'string') return result.feedback
  if (Array.isArray(result?.feedback)) return result.feedback.map(item => typeof item === 'string' ? item : item.message).filter(Boolean).join(' ')
  return result?.feedback?.message || result?.validation?.message || result?.message || (isScorable(result) ? 'Notice the sound and its length, then keep exploring.' : 'We could not confidently measure a vowel. Find a quiet space and say one sound naturally.')
}
export function challengeMatch(result) {
  const analysis = result?.vowel_analysis
  if (typeof analysis?.identity_match === 'boolean' && typeof analysis?.length_match === 'boolean') return analysis.identity_match && analysis.length_match
  const matches = result?.vowel_analysis?.matches
  return typeof matches === 'boolean' ? matches : Boolean(matches?.identity && matches?.length)
}
export function formatPercent(value) { return Number.isFinite(value) ? `${Math.round(value <= 1 ? value * 100 : value)}%` : 'Not available' }
