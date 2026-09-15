// Owns microphone resources independently of React rendering and optional ASR.
export class MicrophoneSession {
  constructor({ scope = globalThis, onComplete, onState, onError, onAnalyser } = {}) {
    Object.assign(this, { scope, onComplete, onState, onError, onAnalyser })
    this.generation = 0
    this.busy = false
  }
  release() {
    clearTimeout(this.timer)
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    this.context?.close().catch(() => {})
    this.context = null
    this.onAnalyser?.(null)
    this.busy = false
  }
  async start() {
    if (this.busy) return false
    const { navigator, MediaRecorder, AudioContext, webkitAudioContext } = this.scope
    if (!navigator?.mediaDevices?.getUserMedia || !MediaRecorder) {
      throw new Error('Microphone recording requires a supported browser on HTTPS or localhost.')
    }
    this.busy = true
    const generation = ++this.generation
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: true, noiseSuppression: false,
      } })
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop())
        return false
      }
      this.stream = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find(type => MediaRecorder.isTypeSupported?.(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      this.recorder = recorder
      const chunks = []
      const startedAt = Date.now()
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => {
        if (generation !== this.generation) return
        const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' })
        this.release()
        this.onState?.(false)
        if (blob.size) this.onComplete?.(blob, Date.now() - startedAt)
        else this.onError?.(new Error('The recording was empty. Please try again.'))
      }
      recorder.onerror = () => {
        this.cancel()
        this.onError?.(new Error('Microphone recording was interrupted. Please try again.'))
      }
      try {
        const Context = AudioContext || webkitAudioContext
        if (Context) {
          this.context = new Context()
          const analyser = this.context.createAnalyser()
          analyser.fftSize = 256
          this.context.createMediaStreamSource(stream).connect(analyser)
          this.onAnalyser?.(analyser)
        }
      } catch { /* Visualization is optional. */ }
      recorder.start(250)
      this.onState?.(true)
      this.timer = setTimeout(() => this.stop(), 18000)
      return true
    } catch (error) {
      if (generation === this.generation) this.release()
      throw error
    }
  }
  stop() {
    if (this.recorder?.state === 'recording') this.recorder.stop()
  }
  cancel() {
    ++this.generation
    if (this.recorder?.state === 'recording') this.recorder.stop()
    this.recorder = null
    this.release()
    this.onState?.(false)
  }
}
