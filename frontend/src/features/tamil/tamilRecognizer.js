const ERRORS = {
  'not-allowed': 'Microphone permission was denied. Allow access in your browser settings and try again.',
  'service-not-allowed': 'Tamil speech recognition is not allowed by this browser.',
  'audio-capture': 'No working microphone was found. Check your input device and try again.',
  'no-speech': 'No speech was recognized. Speak once clearly and try again.',
  network: 'The browser speech service could not connect. Check your connection and try again.',
  aborted: 'Speech recognition was stopped.',
}

/** Thin adapter over the actual browser SpeechRecognition implementation. */
export function createTamilRecognizer(scope = globalThis) {
  const Constructor = scope?.SpeechRecognition || scope?.webkitSpeechRecognition
  let active = null
  let timer = null
  let generation = 0
  const stop = () => {
    generation += 1
    if (timer) clearTimeout(timer)
    timer = null
    if (active) {
      active.onstart = active.onresult = active.onerror = active.onend = null
      active.abort?.()
      active = null
    }
  }
  return {
    available: Boolean(Constructor),
    stop,
    start({ onState = () => {}, onResult = () => {}, onError = () => {} } = {}) {
      stop()
      if (!Constructor) { onError('Tamil speech recognition is unavailable in this browser.'); return false }
      const current = generation
      const recognition = new Constructor()
      active = recognition
      recognition.lang = 'ta-IN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      const settle = (callback, value) => {
        if (current !== generation) return
        stop()
        callback(value)
      }
      recognition.onstart = () => { if (current === generation) onState('listening') }
      recognition.onresult = event => {
        const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim()
        if (transcript) settle(onResult, transcript)
        else settle(onError, 'The browser returned an empty recognition result. Please try again.')
      }
      recognition.onerror = event => settle(onError, ERRORS[event.error] || 'Tamil speech recognition failed. Please try again.')
      recognition.onend = () => settle(onError, 'No Tamil speech was recognized. Please try again.')
      timer = setTimeout(() => settle(onError, 'Tamil speech recognition timed out. Please try again.'), 15000)
      try { recognition.start(); return true } catch {
        settle(onError, 'Tamil speech recognition could not start. Please try again.')
        return false
      }
    },
  }
}
