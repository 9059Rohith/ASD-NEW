const CUES = Object.freeze({
  sparkle: [523, 659], bubble: [392, 523], chime: [523, 659, 784],
  clap: [659, 784, 988], bell: [784, 988, 1175], victory: [523, 659, 784, 1047],
})

export function playFeedbackSound(cue, { enabled = true } = {}) {
  if (!enabled || typeof window === 'undefined') return () => {}
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return () => {}
  const context = new AudioContextClass()
  const notes = CUES[cue] || CUES.sparkle
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime + index * 0.09
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.25)
  })
  const timer = window.setTimeout(() => context.close?.(), notes.length * 90 + 350)
  return () => { window.clearTimeout(timer); context.close?.() }
}
