import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }))
import api from '../../services/api'
import { vowelApi } from './vowelApi'

describe('vowel upload recovery', () => {
  beforeEach(() => api.post.mockReset())
  it('sends WAV with its actual extension and reuses one request after a lost response', async () => {
    api.post.mockRejectedValueOnce({ code: 'ERR_NETWORK' }).mockResolvedValueOnce({ data: { result: { id: 'saved-once' } } })
    const metadata = { session_id: 'session', request_id: 'one-request', target_phoneme: 'a', challenge_index: 0 }
    await vowelApi.analyze(new Blob(['float audio'], { type: 'audio/wav' }), metadata)
    expect(api.post).toHaveBeenCalledTimes(2)
    const form = api.post.mock.calls[0][1]
    expect(form).toBe(api.post.mock.calls[1][1])
    expect(form.get('audio').name).toBe('vowel.wav')
    expect(form.get('request_id')).toBe('one-request')
  })
  it('does not retry validation failures or canceled requests', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 422 } })
    await expect(vowelApi.analyze(new Blob(['audio']), {})).rejects.toMatchObject({ response: { status: 422 } })
    expect(api.post).toHaveBeenCalledOnce()
    api.post.mockClear()
    const controller = new AbortController()
    controller.abort()
    api.post.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    await expect(vowelApi.analyze(new Blob(['audio']), {}, controller.signal)).rejects.toBeDefined()
    expect(api.post).toHaveBeenCalledOnce()
  })
})
