import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }))
import api from '../../services/api'
import { tamilApi } from './tamilApi'

describe('Tamil recording upload retries', () => {
  beforeEach(() => { api.post.mockReset() })
  const metadata = { item_id: 'word-amma', request_id: 'recording-request-one' }
  it('retries a transient response once using exactly the same FormData and request ID', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({ data: { already_saved: true, result: { id: 'saved-once' } } })
    const result = await tamilApi.evaluate(new Blob(['test audio'], { type: 'audio/webm' }), metadata)
    expect(result.already_saved).toBe(true)
    expect(api.post).toHaveBeenCalledTimes(2)
    expect(api.post.mock.calls[0][1]).toBe(api.post.mock.calls[1][1])
    expect(api.post.mock.calls[1][1].get('request_id')).toBe(metadata.request_id)
  })
  it('does not retry rejected requests or canceled uploads', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 422 } })
    await expect(tamilApi.evaluate(new Blob(['audio']), metadata)).rejects.toMatchObject({ response: { status: 422 } })
    expect(api.post).toHaveBeenCalledOnce()
    api.post.mockReset()
    const controller = new AbortController()
    api.post.mockImplementationOnce(async () => { controller.abort(); throw { code: 'ERR_NETWORK' } })
    await expect(tamilApi.evaluate(new Blob(['audio']), metadata, controller.signal)).rejects.toMatchObject({ code: 'ERR_NETWORK' })
    expect(api.post).toHaveBeenCalledOnce()
  })
  it('limits transient retries to one', async () => {
    api.post.mockRejectedValue({ code: 'ERR_NETWORK' })
    await expect(tamilApi.evaluate(new Blob(['audio']), metadata)).rejects.toMatchObject({ code: 'ERR_NETWORK' })
    expect(api.post).toHaveBeenCalledTimes(2)
  })
  it('uploads a recognized Tamil word with the matching microphone recording', async () => {
    api.post.mockResolvedValueOnce({ data: { result: { scorable: true, accuracy: 100 } } })
    await tamilApi.evaluate(new Blob(['audio'], { type: 'audio/webm' }), {
      ...metadata, browser_transcript: 'அம்மா',
    })
    expect(api.post.mock.calls[0][1].get('browser_transcript')).toBe('அம்மா')
  })
})

describe('Tamil recognition answers', () => {
  beforeEach(() => { api.post.mockReset() })
  it('submits the selected catalog ID and stable request ID to the server', async () => {
    const answer = { item_id: 'consonant-ka', selected_id: 'consonant-nga', prompt_type: 'character_recognition', request_id: 'request-one' }
    api.post.mockResolvedValueOnce({ data: { result: { correct: false } } })
    expect((await tamilApi.answer(answer)).result.correct).toBe(false)
    expect(api.post).toHaveBeenCalledWith('/tamil/answer', answer, expect.any(Object))
  })
})
