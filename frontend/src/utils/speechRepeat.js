import { APPLICATION_VOICE_PROFILE_ID, createStoryNarrator, speakCharacter, stopCharacterSpeech } from '../features/characters/characterVoice'
import { storyVoiceAPI } from '../services/api'

export function speakTamilLesson(text, {
  lineId,
  scope = globalThis,
  loadAudio = async (key) => (await storyVoiceAPI.get(key)).data,
  speakFallback = (phrase, options) => repeatPhrase(phrase, { scope, ...options }),
  onStart,
  onEnd,
  onError,
} = {}) {
  const narrator = createStoryNarrator({
    scope,
    loadAudio,
    speakFallback,
    stopNative: () => stopCharacterSpeech(scope?.speechSynthesis),
  })
  return narrator.play({
    lineId,
    text,
    voiceOptions: { guided: true },
    onStart,
    onEnd,
    onError,
  })
}

export function repeatPhrase(text, { scope = globalThis, lang = 'ta-IN', onStart, onEnd, onError } = {}) {
  const phrase = String(text || '').trim()
  if (!phrase || !scope?.speechSynthesis || !scope?.SpeechSynthesisUtterance) return false

  return speakCharacter(phrase, {
    synthesis: scope.speechSynthesis,
    UtteranceCtor: scope.SpeechSynthesisUtterance,
    profileId: lang.toLowerCase().startsWith('ta') ? 'kaviTamil' : APPLICATION_VOICE_PROFILE_ID,
    guided: true,
    language: lang,
    onStart,
    onEnd,
    onError,
  })
}

export function repeatPhraseWithPraise(text, {
  scope = globalThis,
  lang = 'ta-IN',
  praise = 'மிக நன்று!',
  onStart,
  onPraiseStart,
  onEnd,
  onError,
} = {}) {
  let settled = false
  const finish = (callback, value) => {
    if (settled) return
    settled = true
    callback?.(value)
  }
  const fail = (error) => finish(onError, error)
  const speakPraise = () => {
    const praised = speakCharacter(praise, {
      synthesis: scope?.speechSynthesis,
      UtteranceCtor: scope?.SpeechSynthesisUtterance,
      profileId: lang.toLowerCase().startsWith('ta') ? 'kaviTamil' : APPLICATION_VOICE_PROFILE_ID,
      language: lang,
      onStart: onPraiseStart,
      onEnd: () => finish(onEnd),
      onError: fail,
    })
    if (!praised) fail()
  }

  const repeated = repeatPhrase(text, {
    scope,
    lang,
    onStart,
    onEnd: speakPraise,
    onError: fail,
  })
  if (!repeated) fail()
  return repeated
}
