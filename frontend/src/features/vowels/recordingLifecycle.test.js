import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordingLifecycle, microphoneLevel } from './recordingLifecycle'

it('shows quiet real input on the meter while silence stays empty', () => {
  expect(microphoneLevel(0)).toBe(0)
  expect(microphoneLevel(.001)).toBeGreaterThan(.1)
  expect(microphoneLevel(.03)).toBeGreaterThan(microphoneLevel(.001))
  expect(microphoneLevel(2)).toBe(1)
  expect(microphoneLevel(NaN)).toBe(0)
})
import { encodeFloatWav } from './floatPcmCapture'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

function setup() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const context = { state: 'running', resume: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue(), createAnalyser: () => ({ fftSize: 512, getByteTimeDomainData: samples => samples.fill(140) }), createMediaStreamSource: () => source }
  const created = []
  class Recorder {
    static isTypeSupported(type) { return type.includes('webm') }
    constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; created.push(this) }
    start() { this.state = 'recording'; this.startedAt = performance.now() }
    stop() {
      this.state = 'inactive'; this.stoppedAt = performance.now()
      this.ondataavailable?.({ data: new Blob(['real test audio bytes']) })
      this.onstop?.()
    }
  }
  const environment = { navigator: { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } }, MediaRecorder: Recorder, AudioContext: class { constructor() { return context } }, setTimeout, clearTimeout, setInterval, clearInterval, performance, requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn() }
  const changes = []
  const analyze = vi.fn().mockResolvedValue({ result: { scorable: true, accuracy: 81 }, progress: { xp: 8 } })
  const onFrame = vi.fn()
  const lifecycle = new RecordingLifecycle({ environment, onChange: update => changes.push(update), onFrame, analyze })
  return { lifecycle, environment, changes, analyze, created, context, source, track, stream, onFrame }
}

function enableFloatCapture(test, samples = new Float32Array([0.0000001, -0.0000002, .5])) {
  test.context.sampleRate = 48000
  test.context.destination = {}
  test.context.audioWorklet = { addModule: vi.fn().mockResolvedValue() }
  const nodes = []
  test.environment.AudioWorkletNode = class {
    constructor() {
      this.connect = vi.fn(() => this.port.onmessage?.({ data: { type: 'ready' } })); this.disconnect = vi.fn()
      this.port = { close: vi.fn(), onmessage: null, postMessage: vi.fn(message => {
        if (message.type === 'finish') this.port.onmessage?.({ data: { type: 'samples', samples } })
      }) }
      nodes.push(this)
    }
  }
  return nodes
}

describe('seven-second vowel capture', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts its 7 second deadline only after permission, records once, then uploads automatically', async () => {
    const test = setup()
    let permission
    test.environment.navigator.mediaDevices.getUserMedia.mockImplementation(() => new Promise(resolve => { permission = resolve }))
    const started = test.lifecycle.start({ target_phoneme: 'aa' })
    expect(test.lifecycle.state).toBe('GETTING_READY')
    await vi.advanceTimersByTimeAsync(6000)
    expect(test.created).toHaveLength(0)
    permission(test.stream)
    await started
    expect(test.lifecycle.state).toBe('RECORDING')
    await test.lifecycle.start({ target_phoneme: 'aa' })
    expect(test.created).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(6999)
    expect(test.created[0].state).toBe('recording')
    expect(test.analyze).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(test.created[0].stoppedAt - test.created[0].startedAt).toBe(7000)
    expect(test.analyze).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), { target_phoneme: 'aa' }, expect.any(AbortSignal))
    expect(test.changes.some(change => change.state === 'PROCESSING' && change.remaining === 0)).toBe(true)
    expect(test.lifecycle.state).toBe('RESULT')
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(test.context.close).toHaveBeenCalledOnce()
    expect(test.source.disconnect).toHaveBeenCalledOnce()
    expect(test.environment.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('closes a stream whose permission arrives after cancellation without recording', async () => {
    const test = setup()
    let permission
    test.environment.navigator.mediaDevices.getUserMedia.mockImplementation(() => new Promise(resolve => { permission = resolve }))
    const started = test.lifecycle.start({})
    test.lifecycle.cancel()
    permission(test.stream)
    await started
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(test.created).toHaveLength(0)
    expect(test.lifecycle.state).toBe('IDLE')
    expect(test.analyze).not.toHaveBeenCalled()
  })

  it('discards interrupted recordings and clears every timer', async () => {
    const test = setup()
    await test.lifecycle.start({})
    await vi.advanceTimersByTimeAsync(2600)
    test.lifecycle.cancel()
    await vi.advanceTimersByTimeAsync(10000)
    expect(test.analyze).not.toHaveBeenCalled()
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(test.changes.at(-1)).toMatchObject({ state: 'IDLE', remaining: 7, result: null })
  })

  it('ignores late analysis after cancellation and aborts its upload', async () => {
    const test = setup()
    let finish
    test.analyze.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await test.lifecycle.start({})
    await vi.advanceTimersByTimeAsync(7000)
    expect(test.lifecycle.state).toBe('PROCESSING')
    const signal = test.analyze.mock.calls[0][2]
    test.lifecycle.cancel()
    expect(signal.aborted).toBe(true)
    finish({ result: { scorable: true, accuracy: 94 } })
    await Promise.resolve()
    expect(test.lifecycle.state).toBe('IDLE')
  })

  it('does not turn an abstention into a score or advanceable result', async () => {
    const test = setup()
    test.analyze.mockResolvedValue({ result: { scorable: false, accuracy: null, validation_status: 'no_speech' } })
    await test.lifecycle.start({})
    await vi.advanceTimersByTimeAsync(7000)
    expect(test.changes.at(-1)).toMatchObject({ state: 'RETRY', result: { scorable: false, accuracy: null } })
  })

  it('reports permission denial and allows a subsequent new attempt', async () => {
    const test = setup()
    test.environment.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce({ name: 'NotAllowedError' })
    await test.lifecycle.start({})
    expect(test.changes.at(-1)).toMatchObject({ state: 'ERROR', error: expect.stringContaining('browser settings') })
    await test.lifecycle.start({})
    expect(test.lifecycle.state).toBe('RECORDING')
    test.lifecycle.cancel()
  })

  it('uploads float WAV preserving quiet samples and releases the worklet', async () => {
    const test = setup(); const nodes = enableFloatCapture(test)
    await test.lifecycle.start({ target_phoneme: 'a' })
    expect(test.environment.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: { channelCount: 1, autoGainControl: true, echoCancellation: false, noiseSuppression: false }, video: false })
    expect(nodes[0].port.postMessage).toHaveBeenCalledWith({ type: 'start' })
    await vi.advanceTimersByTimeAsync(7000)
    const audio = test.analyze.mock.calls[0][0]
    expect(audio.type).toBe('audio/wav')
    const wav = new DataView(await audio.arrayBuffer())
    expect(wav.getUint16(20, true)).toBe(3)
    expect(wav.getUint16(34, true)).toBe(32)
    expect(wav.getFloat32(58, true)).toBe(Math.fround(.0000001))
    expect(wav.getFloat32(62, true)).toBe(Math.fround(-.0000002))
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(nodes[0].port.close).toHaveBeenCalledOnce()
    expect(nodes[0].disconnect).toHaveBeenCalledOnce()
    expect(test.lifecycle.pcm).toBeNull()
  })

  it('uses the native recorder if a worklet cannot load', async () => {
    const test = setup(); enableFloatCapture(test)
    test.context.audioWorklet.addModule.mockRejectedValue(new Error('not supported'))
    await test.lifecycle.start({})
    await vi.advanceTimersByTimeAsync(7000)
    expect(test.analyze.mock.calls[0][0].type).toBe('audio/webm')
    expect(test.lifecycle.state).toBe('RESULT')
  })

  it('cancels worklet setup without waiting for a stale module or retaining timers', async () => {
    const test = setup(); const nodes = enableFloatCapture(test)
    let loaded
    test.context.audioWorklet.addModule.mockImplementation(() => new Promise(resolve => { loaded = resolve }))
    const start = test.lifecycle.start({})
    await vi.advanceTimersByTimeAsync(1)
    test.lifecycle.cancel()
    loaded()
    await start
    expect(nodes).toHaveLength(0)
    expect(test.track.stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(test.analyze).not.toHaveBeenCalled()
  })

  it('discards worklet samples and ignores pending callbacks on cancellation', async () => {
    const test = setup(); const nodes = enableFloatCapture(test)
    await test.lifecycle.start({})
    const callback = nodes[0].port.onmessage
    test.lifecycle.cancel()
    callback({ data: { type: 'samples', samples: new Float32Array([.001]) } })
    await vi.advanceTimersByTimeAsync(8000)
    expect(test.analyze).not.toHaveBeenCalled()
    expect(nodes[0].port.close).toHaveBeenCalledOnce()
    expect(nodes[0].port.onmessage).toBeNull()
    expect(test.lifecycle.state).toBe('IDLE')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits for first render input before starting the seven-second recorder', async () => {
    const test = setup(); const nodes = enableFloatCapture(test)
    const OriginalNode = test.environment.AudioWorkletNode
    test.environment.AudioWorkletNode = class extends OriginalNode { constructor(...args) { super(...args); this.connect = vi.fn() } }
    const started = test.lifecycle.start({})
    await vi.advanceTimersByTimeAsync(500)
    expect(test.lifecycle.state).toBe('GETTING_READY')
    expect(test.created).toHaveLength(0)
    nodes[0].port.onmessage({ data: { type: 'ready' } })
    await started
    await vi.advanceTimersByTimeAsync(6999)
    expect(test.analyze).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(test.analyze).toHaveBeenCalledOnce()
  })

  it('disposes a worklet canceled while waiting for first input', async () => {
    const test = setup(); const nodes = enableFloatCapture(test)
    const OriginalNode = test.environment.AudioWorkletNode
    test.environment.AudioWorkletNode = class extends OriginalNode { constructor(...args) { super(...args); this.connect = vi.fn() } }
    const started = test.lifecycle.start({})
    await vi.advanceTimersByTimeAsync(1)
    test.lifecycle.cancel()
    await started
    expect(nodes[0].port.close).toHaveBeenCalledOnce()
    expect(test.created).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(test.track.stop).toHaveBeenCalledOnce()
  })

  it('falls back when the worklet fails during a recording', async () => {
    const test = setup(); const nodes = enableFloatCapture(test)
    await test.lifecycle.start({})
    nodes[0].onprocessorerror()
    await vi.advanceTimersByTimeAsync(7000)
    expect(test.analyze.mock.calls[0][0].type).toBe('audio/webm')
    expect(nodes[0].port.close).toHaveBeenCalledOnce()
  })

  it('aborts a pending worklet flush without uploading or retaining sample timers', async () => {
    const test = setup(); const nodes = enableFloatCapture(test)
    await test.lifecycle.start({})
    nodes[0].port.postMessage = vi.fn()
    await vi.advanceTimersByTimeAsync(7000)
    expect(test.lifecycle.state).toBe('PROCESSING')
    expect(test.track.stop).toHaveBeenCalledOnce()
    test.lifecycle.cancel()
    await vi.advanceTimersByTimeAsync(1000)
    expect(test.analyze).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(test.lifecycle.pcm).toBeNull()
  })

  it('does not quantize a quiet live meter to zero through byte waveform data', async () => {
    const test = setup()
    test.context.createAnalyser = () => ({ fftSize: 512,
      getByteTimeDomainData: samples => samples.fill(128),
      getFloatTimeDomainData: samples => samples.fill(.001) })
    await test.lifecycle.start({})
    expect(test.onFrame.mock.calls[0][1]).toBeGreaterThan(0)
    expect(test.onFrame.mock.calls[0][1]).toBeCloseTo(1 / 3, 6)
    test.lifecycle.cancel()
  })
})

describe('bounded lossless float capture', () => {
  it('encodes distinct below-PCM16 samples without clipping, amplification or quantization', async () => {
    const samples = new Float32Array([1e-8, 2e-8, -1e-8, .99, -.99])
    const encoded = new DataView(await encodeFloatWav(samples, 48000).arrayBuffer())
    expect(encoded.getUint32(24, true)).toBe(48000)
    expect(encoded.getUint32(54, true)).toBe(samples.length * 4)
    samples.forEach((sample, index) => expect(encoded.getFloat32(58 + index * 4, true)).toBe(sample))
  })

  it('collects real render input only after start and stops at seven seconds', () => {
    let Processor
    const messages = []
    const scope = { sampleRate: 100, Float32Array, AudioWorkletProcessor: class {
      constructor() { this.port = { onmessage: null, postMessage: data => messages.push(data) } }
    }, registerProcessor: (_name, implementation) => { Processor = implementation } }
    runInNewContext(readFileSync(new URL('./floatPcmWorklet.js', import.meta.url), 'utf8'), scope)
    const worklet = new Processor()
    worklet.process([[new Float32Array(100).fill(.8)]], [[new Float32Array(100)]])
    worklet.port.onmessage({ data: { type: 'start' } })
    for (let index = 0; index < 9; index += 1) worklet.process([[new Float32Array(100).fill(.0000001)]], [[new Float32Array(100)]])
    expect(messages[0]).toEqual({ type: 'ready' })
    expect(messages).toHaveLength(2)
    expect(messages[1].samples).toHaveLength(700)
    expect(messages[1].samples.every(sample => sample === Math.fround(.0000001))).toBe(true)
    expect(worklet.samples).toBeNull()
  })
})
