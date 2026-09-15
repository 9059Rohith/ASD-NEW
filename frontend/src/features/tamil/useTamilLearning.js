import { useCallback, useEffect, useRef, useState } from 'react'
import { microphoneMessage, RecordingLifecycle } from '../vowels/recordingLifecycle'
import { tamilApi } from './tamilApi'
import { createTamilRequestId } from './tamilLearning'
import { createTamilRecognizer } from './tamilRecognizer'

export function useTamilCatalog() {
  const [state, setState] = useState({ items: [], loading: true, error: null })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState(previous => ({ ...previous, loading: true, error: null }))
    tamilApi.catalog(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ items: data.items || [], loading: false, error: null })
    }).catch(error => { if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: microphoneMessage(error) })) })
    return () => controller.abort()
  }, [version])
  return { ...state, retry: () => setVersion(value => value + 1) }
}

export function useTamilProgress() {
  const [state, setState] = useState({ progress: null, loading: true, error: null })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    tamilApi.progress(controller.signal).then(progress => {
      if (!controller.signal.aborted) setState({ progress, loading: false, error: null })
    }).catch(error => { if (!controller.signal.aborted) setState({ progress: null, loading: false, error: microphoneMessage(error) }) })
    return () => controller.abort()
  }, [version])
  return { ...state, refresh: () => setVersion(value => value + 1) }
}

export function useTamilExample(text, audioUrl) {
  const available = Boolean(audioUrl)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState(null)
  const audio = useRef(null)
  const generation = useRef(0)
  const releaseAudio = useCallback(() => {
    generation.current += 1
    if (audio.current) {
      audio.current.onended = null
      audio.current.onplaying = null
      audio.current.onerror = null
      audio.current.pause()
      audio.current.src = ''
      audio.current = null
    }
  }, [])
  useEffect(() => () => releaseAudio(), [releaseAudio])
  const stop = useCallback(() => { releaseAudio(); setSpeaking(false) }, [releaseAudio])
  useEffect(() => { stop(); setError(null) }, [text, audioUrl, stop])
  const play = useCallback(() => {
    stop()
    setError(null)
    if (audioUrl) {
      const current = generation.current
      const reference = new Audio(audioUrl)
      audio.current = reference
      reference.onplaying = () => { if (generation.current === current) setSpeaking(true) }
      reference.onended = () => { if (generation.current === current) setSpeaking(false) }
      const failed = () => {
        if (generation.current === current) {
          setSpeaking(false)
          setError('தமிழ் எடுத்துக்காட்டைத் திறக்க முடியவில்லை. Please try playing the example again. You can still record.')
        }
      }
      reference.onerror = failed
      reference.play().catch(failed)
      return
    }
    setError('A Tamil audio example is not available for this lesson yet.')
  }, [audioUrl, stop])
  return { available, speaking, error, play, stop }
}

export function useTamilRecording(item) {
  const [capture, setCapture] = useState({ state: 'IDLE', remaining: 7, result: null, error: null })
  const waveform = useRef(null)
  const level = useRef(null)
  const lifecycle = useRef(null)
  const recognizer = useRef(null)
  const transcript = useRef('')
  const draw = useCallback((samples, amplitude) => {
    if (level.current) {
      level.current.style.setProperty('--tamil-audio-level', String(amplitude))
      level.current.setAttribute('aria-valuenow', String(Math.round(amplitude * 100)))
    }
    const surface = waveform.current
    const context = surface?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, surface.width, surface.height)
    if (!samples) return
    context.strokeStyle = '#143c31'
    context.lineWidth = 2
    context.beginPath()
    samples.forEach((sample, index) => {
      const x = index / (samples.length - 1) * surface.width
      const y = surface.height / 2 + (sample - 128) / 128 * surface.height * .45
      if (index) context.lineTo(x, y); else context.moveTo(x, y)
    })
    context.stroke()
  }, [])
  useEffect(() => {
    let active = true
    setCapture({ state: 'IDLE', remaining: 7, result: null, error: null })
    recognizer.current = ['word', 'sentence'].includes(item.kind) ? createTamilRecognizer(window) : null
    const analyze = (audio, metadata, signal) => tamilApi.evaluate(audio, {
      ...metadata, browser_transcript: transcript.current,
    }, signal)
    const recorder = new RecordingLifecycle({ onChange: change => { if (active) setCapture(previous => ({ ...previous, ...change })) }, onFrame: draw, analyze })
    lifecycle.current = recorder
    return () => { active = false; recognizer.current?.stop(); recorder.cancel({ silent: true }) }
  }, [item.id, item.kind, draw])
  const start = () => {
    transcript.current = ''
    recognizer.current?.start({ onResult: value => { transcript.current = value } })
    lifecycle.current?.start({ item_id: item.id, request_id: createTamilRequestId() })
  }
  const cancel = () => { recognizer.current?.stop(); lifecycle.current?.cancel() }
  return { ...capture, waveform, level, start, cancel }
}
