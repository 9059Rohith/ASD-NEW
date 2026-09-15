/* Audio render thread: preserve microphone Float32 samples, never synthesize
 * or amplify input. The disconnected/finished processor retains no recording. */
class VowelFloatCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.samples = new Float32Array(Math.ceil(sampleRate * 7))
    this.count = 0
    this.active = false
    this.finished = false
    this.inputReady = false
    this.port.onmessage = ({ data }) => {
      if (data.type === 'start' && !this.finished) this.active = true
      else if (data.type === 'finish') this.finish()
      else if (data.type === 'cancel') {
        this.active = false
        this.finished = true
        this.samples = null
      }
    }
  }

  finish() {
    if (this.finished) return
    this.finished = true
    this.active = false
    const samples = this.samples.subarray(0, this.count).slice()
    this.samples = null
    this.port.postMessage({ type: 'samples', samples }, [samples.buffer])
  }

  process(inputs, outputs) {
    // Keep the graph alive through a silent output; microphone input is never
    // routed to speakers, so recording cannot create acoustic feedback.
    for (const channel of outputs[0] || []) channel.fill(0)
    if (this.finished) return false
    const input = inputs[0]?.[0]
    if (input?.length && !this.inputReady) {
      this.inputReady = true
      this.port.postMessage({ type: 'ready' })
    }
    if (this.active && input?.length) {
      const count = Math.min(input.length, this.samples.length - this.count)
      this.samples.set(input.subarray(0, count), this.count)
      this.count += count
      if (this.count === this.samples.length) this.finish()
    }
    return !this.finished
  }
}

registerProcessor('vowel-float-capture', VowelFloatCaptureProcessor)
