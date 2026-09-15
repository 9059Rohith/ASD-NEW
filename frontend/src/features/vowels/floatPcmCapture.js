const WORKLET_URL = new URL('./floatPcmWorklet.js?no-inline', import.meta.url)
const MAX_RATE = 96000 // 7 seconds mono float32 <= 2.7 MB, below both API caps.

function waitForReady(promise, environment, signal) {
  return new Promise(resolve => {
    let settled = false
    const done = value => {
      if (settled) return
      settled = true
      environment.clearTimeout(timer)
      signal.removeEventListener('abort', aborted)
      resolve(value)
    }
    const aborted = () => done(false)
    const timer = environment.setTimeout(() => done(false), 2000)
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) done(false)
    else Promise.resolve(promise).then(value => done(value !== false), () => done(false))
  })
}

/** IEEE float WAV: preserve values below PCM16's quantization step. */
export function encodeFloatWav(samples, sampleRate) {
  if (!(samples instanceof Float32Array) || !samples.length || !Number.isInteger(sampleRate) || sampleRate <= 0 || sampleRate > MAX_RATE || samples.length > sampleRate * 7) {
    throw new Error('Invalid or overlong float recording.')
  }
  const buffer = new ArrayBuffer(58 + samples.length * 4)
  const view = new DataView(buffer)
  const text = (offset, value) => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)) }
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 18, true)
  view.setUint16(20, 3, true); view.setUint16(22, 1, true) // IEEE_FLOAT, mono
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true)
  view.setUint16(32, 4, true); view.setUint16(34, 32, true); view.setUint16(36, 0, true)
  text(38, 'fact'); view.setUint32(42, 4, true); view.setUint32(46, samples.length, true)
  text(50, 'data'); view.setUint32(54, samples.length * 4, true)
  samples.forEach((sample, index) => {
    if (!Number.isFinite(sample)) throw new Error('Non-finite microphone samples.')
    view.setFloat32(58 + index * 4, sample, true)
  })
  return new Blob([buffer], { type: 'audio/wav' })
}

/** Optional second capture path. The native recorder remains the fallback. */
export class FloatPcmCapture {
  static async create(context, source, environment, signal) {
    if (!context.audioWorklet?.addModule || !environment.AudioWorkletNode || !Number.isInteger(context.sampleRate) || context.sampleRate <= 0 || context.sampleRate > MAX_RATE || signal.aborted) return null
    const loaded = await new Promise(resolve => {
      let settled = false
      const done = value => {
        if (settled) return
        settled = true
        environment.clearTimeout(timer)
        signal.removeEventListener('abort', aborted)
        resolve(value)
      }
      const aborted = () => done(false)
      const timer = environment.setTimeout(() => done(false), 2000)
      signal.addEventListener('abort', aborted, { once: true })
      try { Promise.resolve(context.audioWorklet.addModule(WORKLET_URL.href)).then(() => done(true), () => done(false)) } catch { done(false) }
    })
    if (!loaded || signal.aborted) return null
    let capture
    try {
      const node = new environment.AudioWorkletNode(context, 'vowel-float-capture', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit',
      })
      capture = new FloatPcmCapture(node, source, context.sampleRate, environment)
      source.connect(node)
      node.connect(context.destination)
      // A MediaStreamSource can initially render no frames. Do not spend part
      // of the seven-second recording waiting for its audio graph to become live.
      if (!await waitForReady(capture.ready, environment, signal)) {
        capture.dispose()
        return null
      }
      return capture
    } catch {
      capture?.dispose()
      return null
    }
  }

  constructor(node, source, sampleRate, environment) {
    this.node = node
    this.source = source
    this.sampleRate = sampleRate
    this.env = environment
    this.samples = null
    this.disposed = false
    this.done = new Promise(resolve => { this.resolve = resolve })
    this.ready = new Promise(resolve => { this.resolveReady = resolve })
    node.port.onmessage = ({ data }) => {
      if (this.disposed) return
      if (data.type === 'ready') { this.resolveReady(true); return }
      if (data.type !== 'samples') return
      this.samples = data.samples
      this.resolve()
    }
    node.onprocessorerror = () => this.dispose()
  }

  start() { if (!this.disposed) this.node.port.postMessage({ type: 'start' }) }

  async finish() {
    if (this.disposed) return null
    try {
      this.node.port.postMessage({ type: 'finish' })
      await Promise.race([this.done, new Promise(resolve => { this.timer = this.env.setTimeout(resolve, 500) })])
      return !this.disposed && this.samples?.length ? encodeFloatWav(this.samples, this.sampleRate) : null
    } catch { return null } finally { this.dispose() }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.env.clearTimeout(this.timer)
    this.samples = null
    this.resolve()
    this.resolveReady(false)
    this.node.onprocessorerror = null
    this.node.port.onmessage = null
    try { this.node.port.postMessage({ type: 'cancel' }) } catch { /* Port already closed. */ }
    this.node.port.close()
    this.node.disconnect()
    try { this.source.disconnect(this.node) } catch { /* Source may already be disconnected. */ }
    this.node = null
    this.source = null
  }
}
