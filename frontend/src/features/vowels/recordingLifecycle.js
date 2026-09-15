import { FloatPcmCapture } from './floatPcmCapture'

export const RECORDING_MS = 7000
export const RECORDING_STATES = Object.freeze(['IDLE', 'GETTING_READY', 'RECORDING', 'PROCESSING', 'RESULT', 'RETRY', 'COMPLETED', 'ERROR'])

// Display scale only: make quiet real input visible without changing audio.
export function microphoneLevel(rms) {
  if (!Number.isFinite(rms) || rms <= 0) return 0
  return Math.max(0, Math.min(1, (20 * Math.log10(rms) + 80) / 60))
}

export function microphoneMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Microphone access is blocked. Allow it in your browser settings, then try again.'
  if (error?.name === 'NotFoundError') return 'No microphone was found. Connect a microphone and try again.'
  if (error?.name === 'NotReadableError') return 'Your microphone is busy. Close another app using it, then try again.'
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(item => item.msg || 'Check the requested sound and try again.').join(' ')
  return error?.message || 'We could not hear this attempt. Please try again.'
}

/** Owns microphone resources, including streams arriving after cancellation. */
export class RecordingLifecycle {
  constructor({ onChange, onFrame = () => {}, analyze, environment = globalThis }) {
    this.env = environment
    this.onChange = onChange
    this.onFrame = onFrame
    this.analyze = analyze
    this.generation = 0
    this.state = 'IDLE'
  }

  emit(state, extra = {}) {
    this.state = state
    this.onChange({ state, ...extra })
  }

  stopClock() {
    this.env.clearTimeout(this.deadline)
    this.env.clearInterval(this.clock)
    if (this.frame != null) this.env.cancelAnimationFrame(this.frame)
  }

  cleanupCapture() {
    this.stopClock()
    this.captureSetup?.abort()
    this.captureSetup = null
    this.pcm?.dispose()
    this.pcm = null
    if (this.recorder) {
      this.recorder.ondataavailable = null
      this.recorder.onstop = null
      this.recorder.onerror = null
      if (this.recorder.state !== 'inactive') this.recorder.stop()
      this.recorder = null
    }
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    this.source?.disconnect()
    this.source = null
    if (this.context?.state !== 'closed') this.context?.close().catch(() => {})
    this.context = null
    this.onFrame(null, 0)
  }

  cancel({ silent = false } = {}) {
    this.generation += 1
    this.abort?.abort()
    this.cleanupCapture()
    if (!silent) this.emit('IDLE', { remaining: 7, result: null, error: null })
  }

  async start(metadata) {
    if (['GETTING_READY', 'RECORDING', 'PROCESSING'].includes(this.state)) return
    const generation = ++this.generation
    this.emit('GETTING_READY', { remaining: 7, result: null, error: null })
    try {
      const AudioContext = this.env.AudioContext || this.env.webkitAudioContext
      if (!this.env.navigator?.mediaDevices?.getUserMedia || !this.env.MediaRecorder || !AudioContext) throw new Error('This browser cannot record audio. Use a recent browser with microphone access on HTTPS or localhost.')
      const stream = await this.env.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, autoGainControl: true, echoCancellation: false, noiseSuppression: false }, video: false })
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      this.stream = stream
      this.context = new AudioContext()
      await this.context.resume()
      if (generation !== this.generation) return
      const analyser = this.context.createAnalyser()
      analyser.fftSize = 512
      this.source = this.context.createMediaStreamSource(stream)
      this.source.connect(analyser)
      this.captureSetup = new AbortController()
      const pcm = await FloatPcmCapture.create(this.context, this.source, this.env, this.captureSetup.signal)
      if (generation !== this.generation) { pcm?.dispose(); return }
      this.pcm = pcm
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => this.env.MediaRecorder.isTypeSupported(type))
      const recorder = new this.env.MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      this.recorder = recorder
      const chunks = []
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data) }
      recorder.onerror = event => {
        if (generation !== this.generation) return
        this.cleanupCapture()
        this.emit('ERROR', { error: microphoneMessage(event.error) })
      }
      recorder.onstop = async () => {
        if (generation !== this.generation) return
        let audio = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        chunks.length = 0
        this.stopClock()
        this.stream?.getTracks().forEach(track => track.stop())
        this.stream = null
        this.emit('PROCESSING', { remaining: 0 })
        if (this.pcm) audio = await this.pcm.finish() || audio
        if (generation !== this.generation) return
        this.cleanupCapture()
        this.abort = new AbortController()
        try {
          if (!audio.size) throw new Error('The microphone returned an empty recording. Please try again.')
          const response = await this.analyze(audio, metadata, this.abort.signal)
          if (generation !== this.generation) return
          const result = response.result || response
          this.emit(result.scorable === true ? 'RESULT' : 'RETRY', { result, response })
        } catch (error) {
          if (generation === this.generation) this.emit('ERROR', { error: microphoneMessage(error) })
        }
      }
      recorder.start()
      try { this.pcm?.start() } catch { this.pcm?.dispose(); this.pcm = null }
      const startedAt = this.env.performance.now()
      this.emit('RECORDING', { remaining: 7 })
      this.deadline = this.env.setTimeout(() => {
        if (generation === this.generation && recorder.state === 'recording') recorder.stop()
      }, RECORDING_MS)
      this.clock = this.env.setInterval(() => {
        if (generation === this.generation) this.emit('RECORDING', { remaining: Math.max(0, (RECORDING_MS - (this.env.performance.now() - startedAt)) / 1000) })
      }, 100)
      const samples = new Uint8Array(analyser.fftSize)
      const floatSamples = typeof analyser.getFloatTimeDomainData === 'function' ? new Float32Array(analyser.fftSize) : null
      const draw = () => {
        if (generation !== this.generation || this.state !== 'RECORDING') return
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        if (floatSamples) {
          analyser.getFloatTimeDomainData(floatSamples)
          for (const sample of floatSamples) sum += sample ** 2
        } else for (const sample of samples) sum += ((sample - 128) / 128) ** 2
        this.onFrame(samples, microphoneLevel(Math.sqrt(sum / samples.length)))
        this.frame = this.env.requestAnimationFrame(draw)
      }
      draw()
    } catch (error) {
      if (generation !== this.generation) return
      this.cleanupCapture()
      this.emit('ERROR', { error: microphoneMessage(error) })
    }
  }
}
