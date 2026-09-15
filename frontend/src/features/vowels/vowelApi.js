import api from '../../services/api'

export const requestId = () => globalThis.crypto?.randomUUID?.() || `vowel-${Date.now()}-${Math.random().toString(36).slice(2)}`
export const vowelApi = {
  catalog: signal => api.get('/vowels/catalog', { signal }).then(r => r.data),
  createSession: (mode, target_phoneme, signal) => api.post('/vowels/sessions', { mode, target_phoneme }, { signal }).then(r => r.data),
  analyze: async (audio, metadata, signal) => {
    const { debug, ...fields } = metadata
    const form = new FormData()
    const extension = audio.type.includes('wav') ? 'wav' : audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'
    form.append('audio', audio, `vowel.${extension}`)
    Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)))
    const send = () => api.post('/vowels/analyze', form, { signal, params: debug ? { debug: true } : undefined, headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    try { return await send() } catch (error) {
      const transient = [502, 503, 504].includes(error.response?.status) || ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
      if (signal?.aborted || error.code === 'ERR_CANCELED' || !transient) throw error
      // The same request and bytes let the server replay a saved result safely.
      return send()
    }
  },
  answer: (id, body, signal) => api.post(`/vowels/sessions/${id}/answer`, body, { signal }).then(r => r.data),
  complete: (id, signal) => api.post(`/vowels/sessions/${id}/complete`, {}, { signal }).then(r => r.data),
  progress: signal => api.get('/vowels/progress', { signal }).then(r => r.data),
  history: signal => api.get('/vowels/sessions', { signal }).then(r => r.data),
}
