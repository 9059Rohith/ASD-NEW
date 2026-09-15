import api from '../../services/api'

export const tamilApi = {
  catalog: signal => api.get('/tamil/catalog', { signal }).then(response => response.data),
  progress: signal => api.get('/tamil/progress', { signal }).then(response => response.data),
  insights: signal => api.get('/tamil/insights', { signal }).then(response => response.data),
  answer: (answer, signal) => api.post('/tamil/answer', answer, { signal }).then(response => response.data),
  gameAnswer: (answer, signal) => api.post('/tamil/game-answer', answer, { signal }).then(response => response.data),
  evaluate: async (audio, metadata, signal) => {
    const form = new FormData()
    const extension = audio.type.includes('wav') ? 'wav' : audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'
    form.append('audio', audio, `tamil-practice.${extension}`)
    form.append('item_id', metadata.item_id)
    form.append('request_id', metadata.request_id)
    if (metadata.browser_transcript) form.append('browser_transcript', metadata.browser_transcript)
    const send = () => api.post('/tamil/evaluate', form, { signal, headers: { 'Content-Type': 'multipart/form-data' } }).then(response => response.data)
    try { return await send() } catch (error) {
      const transient = [502, 503, 504].includes(error.response?.status) || ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
      if (signal?.aborted || error.code === 'ERR_CANCELED' || !transient) throw error
      // Reuse the same bytes and request ID so a lost response cannot create a
      // second saved attempt. A new microphone recording gets a new ID.
      return send()
    }
  },
}
