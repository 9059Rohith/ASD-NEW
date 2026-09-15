import { describe, expect, it, vi } from 'vitest'
import { repeatPhrase, repeatPhraseWithPraise, speakTamilLesson } from './speechRepeat'

describe('repeatPhrase', () => {
  it('uses allow-listed neural audio before the browser Tamil fallback', async () => {
    const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() }
    const fallback = vi.fn()
    const scope = {
      Audio: vi.fn(function Audio() { return audio }),
      URL: { createObjectURL: vi.fn(() => 'blob:tamil'), revokeObjectURL: vi.fn() },
      setTimeout,
      clearTimeout,
    }

    const mode = await speakTamilLesson('மரம்', {
      lineId: 'lesson_15',
      scope,
      loadAudio: vi.fn(async () => new Blob(['azure-tamil'], { type: 'audio/mpeg' })),
      speakFallback: fallback,
    })

    expect(mode).toBe('remote')
    expect(audio.play).toHaveBeenCalledOnce()
    expect(fallback).not.toHaveBeenCalled()
  })

  it('speaks the exact cleaned phrase without adding a prefix', () => {
    const speak = vi.fn()
    const scope = {
      speechSynthesis: { cancel: vi.fn(), speak },
      SpeechSynthesisUtterance: class FakeUtterance {
        constructor(text) { this.text = text }
      },
    }

    expect(repeatPhrase('  I am happy  ', { scope })).toBe(true)
    expect(scope.speechSynthesis.cancel).toHaveBeenCalledOnce()
    expect(speak).toHaveBeenCalledOnce()
    expect(speak.mock.calls[0][0].text).toBe('I am happy')
    expect(speak.mock.calls[0][0]).toMatchObject({ pitch: 1.12, rate: 0.82, volume: 0.94, lang: 'ta-IN' })
  })

  it('uses the exact Indian Tamil voice for training repeats', () => {
    const voices = [
      { name: 'Microsoft Ravi', lang: 'en-IN', localService: true },
      { name: 'Microsoft Pallavi', lang: 'ta-IN', localService: true },
    ]
    const speak = vi.fn()
    const scope = {
      speechSynthesis: { cancel: vi.fn(), speak, getVoices: () => voices },
      SpeechSynthesisUtterance: class FakeUtterance {
        constructor(text) { this.text = text }
      },
    }

    repeatPhrase('LA', { scope })

    expect(speak.mock.calls[0][0].voice).toBe(voices[1])
  })

  it('does nothing when speech synthesis is unavailable', () => {
    expect(repeatPhrase('hello', { scope: {} })).toBe(false)
    expect(repeatPhrase('   ', { scope: {} })).toBe(false)
  })

  it('reports repeat lifecycle events to the training coach', () => {
    const onStart = vi.fn()
    const onEnd = vi.fn()
    const scope = {
      speechSynthesis: { cancel: vi.fn(), speak: (utterance) => { utterance.onstart(); utterance.onend() } },
      SpeechSynthesisUtterance: class FakeUtterance {
        constructor(text) { this.text = text }
      },
    }

    expect(repeatPhrase('LA', { scope, onStart, onEnd })).toBe(true)
    expect(onStart).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('repeats the Tamil target and praises in Tamil with the same locale', () => {
    const utterances = []
    const onEnd = vi.fn()
    const scope = {
      speechSynthesis: {
        cancel: vi.fn(),
        getVoices: () => [{ name: 'Microsoft Pallavi', lang: 'ta-IN' }],
        speak: (utterance) => utterances.push(utterance),
      },
      SpeechSynthesisUtterance: class FakeUtterance {
        constructor(text) { this.text = text }
      },
    }

    expect(repeatPhraseWithPraise('  aa  ', { scope, onEnd })).toBe(true)
    expect(utterances.map((utterance) => utterance.text)).toEqual(['aa'])
    utterances[0].onend()
    expect(utterances.map((utterance) => utterance.text)).toEqual(['aa', 'மிக நன்று!'])
    expect(utterances[1]).toMatchObject({ pitch: 1.12, lang: 'ta-IN', voice: { name: 'Microsoft Pallavi' } })
    utterances[1].onend()
    expect(onEnd).toHaveBeenCalledOnce()
  })
})
