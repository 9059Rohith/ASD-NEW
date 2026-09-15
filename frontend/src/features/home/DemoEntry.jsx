import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { homeForRole } from '../../utils/roleRouting'

export default function DemoEntry() {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const setAuth = useAuthStore(state => state.setAuth)
  const lock = useRef(false)
  const pending = useRef(null)
  useEffect(() => () => pending.current?.abort(), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const enter = async () => {
    if (lock.current) return
    if (user) { navigate(user.role === 'user' ? '/tamil' : homeForRole(user.role)); return }
    lock.current = true
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      const { data } = await authAPI.login({ email: 'demo@speakeasy.app', password: 'Demo@1234' }, { signal: controller.signal })
      if (controller.signal.aborted) return
      setAuth(data.user, data.access_token)
      navigate('/tamil')
    } catch {
      if (!controller.signal.aborted) setError('The demo could not open. Please try again in a moment.')
    } finally { lock.current = false; if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className="home-demo-entry"><button type="button" onClick={enter} disabled={busy} className="voice-text-link">{busy ? <Loader2 size={17} className="home-demo-spinner" aria-hidden="true" /> : <ArrowUpRight size={17} aria-hidden="true" />}{busy ? 'Opening your demo…' : user ? 'Continue learning' : 'Try the full demo'}</button><span>Listen, practise and play with Pippin.</span>{error && <p role="alert">{error}</p>}</div>
}
