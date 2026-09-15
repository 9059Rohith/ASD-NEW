import { describe, expect, it, vi } from 'vitest'
import { createTamilRecognizer } from './tamilRecognizer'

class Recognition {
  constructor() { Recognition.latest = this }
  start() { this.onstart?.() }
  abort() { this.aborted = true }
}

describe('browser Tamil recognition', () => {
  it('requests Tamil and returns the real recognized transcript', () => {
    const onResult = vi.fn()
    const recognizer = createTamilRecognizer({ SpeechRecognition: Recognition })
    expect(recognizer.available).toBe(true)
    recognizer.start({ onResult })
    expect(Recognition.latest.lang).toBe('ta-IN')
    Recognition.latest.onresult({ results: [[{ transcript: 'அம்மா' }]] })
    expect(onResult).toHaveBeenCalledWith('அம்மா')
  })
  it('distinguishes unsupported and denied microphone states', () => {
    expect(createTamilRecognizer({}).available).toBe(false)
    const onError = vi.fn()
    createTamilRecognizer({ webkitSpeechRecognition: Recognition }).start({ onError })
    Recognition.latest.onerror({ error: 'not-allowed' })
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('permission'))
  })
  it('cancels the live recognizer without reporting a false result', () => {
    const onResult = vi.fn()
    const recognizer = createTamilRecognizer({ SpeechRecognition: Recognition })
    recognizer.start({ onResult })
    const active = Recognition.latest
    recognizer.stop()
    active.onresult?.({ results: [[{ transcript: 'அம்மா' }]] })
    expect(active.aborted).toBe(true)
    expect(onResult).not.toHaveBeenCalled()
  })
  it('reports empty and network results separately from a real transcript', () => {
    const onError = vi.fn()
    const recognizer = createTamilRecognizer({ SpeechRecognition: Recognition })
    recognizer.start({ onError })
    Recognition.latest.onresult({ results: [[{ transcript: '   ' }]] })
    expect(onError).toHaveBeenLastCalledWith(expect.stringContaining('empty'))
    recognizer.start({ onError })
    Recognition.latest.onerror({ error: 'network' })
    expect(onError).toHaveBeenLastCalledWith(expect.stringContaining('connect'))
  })
  it('reports timeout and releases the microphone session', () => {
    vi.useFakeTimers()
    try {
      const onError = vi.fn()
      const recognizer = createTamilRecognizer({ SpeechRecognition: Recognition })
      recognizer.start({ onError })
      const active = Recognition.latest
      vi.advanceTimersByTime(15000)
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('timed out'))
      expect(active.aborted).toBe(true)
    } finally { vi.useRealTimers() }
  })
})
