import { describe, it, expect, vi } from 'vitest'
import { MicrophoneSession } from './microphoneSession'

function setup() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  class Recorder {
    static isTypeSupported(type) { return type === 'audio/mp4' }
    constructor(_stream, options) { this.mimeType = options.mimeType; this.state = 'inactive' }
    start() { this.state = 'recording' }
    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['audio']) })
      this.onstop?.()
    }
  }
  const scope = { MediaRecorder: Recorder, navigator: { mediaDevices: { getUserMedia: vi.fn(async () => stream) } } }
  const onComplete = vi.fn()
  return { scope, track, onComplete, session: new MicrophoneSession({ scope, onComplete }) }
}

describe('microphone capture lifecycle', () => {
  it('negotiates a supported MIME and releases the microphone on stop', async () => {
    const { session, scope, onComplete, track } = setup()
    await session.start()
    expect(scope.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: false,
    } })
    session.stop()
    expect(onComplete.mock.calls[0][0].type).toBe('audio/mp4')
    expect(track.stop).toHaveBeenCalledOnce()
  })
  it('does not submit a cancelled recording or allow overlapping starts', async () => {
    const { session, scope, onComplete, track } = setup()
    const pending = session.start()
    expect(await session.start()).toBe(false)
    await pending
    session.cancel()
    expect(onComplete).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalledOnce()
    expect(scope.navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce()
  })
  it('releases a stream granted after cancellation', async () => {
    const { session, scope, track } = setup()
    let grant
    scope.navigator.mediaDevices.getUserMedia.mockImplementation(() => new Promise(resolve => { grant = resolve }))
    const pending = session.start()
    session.cancel()
    grant({ getTracks: () => [track] })
    expect(await pending).toBe(false)
    expect(track.stop).toHaveBeenCalledOnce()
  })
})
