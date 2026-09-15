import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AudioWaveform, ArrowUpRight, Menu, X, UserRound, LogOut, Settings2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authAPI } from '../../services/api'
import { useInteractionSettingsStore } from '../../store/interactionSettingsStore'
import '../../styles/vowel-world.css'
import '../../styles/responsive-backgrounds.css'

export const LEARNING_NAV = [['Home', '/'], ['Learn Tamil', '/tamil'], ['Games', '/games'], ['Evaluate', '/evaluate'], ['Progress', '/progress']]

export function VoiceBrand() {
  return <Link className="voice-brand" to="/" aria-label="ASD-Edge-ST home"><span className="voice-brand-mark"><AudioWaveform size={26} aria-hidden="true" /></span><span>ASD-Edge-ST<small>VOWEL STUDIO</small></span></Link>
}

export default function VowelShell({ children, className = '', footer = true }) {
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState(false)
  const motionLevel = useInteractionSettingsStore(state => state.preferences.motionLevel)
  const updatePreference = useInteractionSettingsStore(state => state.updatePreference)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => { setOpen(false); setAccount(false); window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') { setOpen(false); setAccount(false) } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  const signOut = async () => { try { await authAPI.logout() } catch { /* Local session must still clear. */ } logout(); navigate('/') }
  const nav = user?.role === 'therapist' ? [['Home', '/'], ['Care team', '/therapist'], ['Reports', '/reports'], ['Appointments', '/appointments']] : LEARNING_NAV
  return <div className={`voice-world ${className}`}>
    <a className="voice-skip" href="#voice-main">Skip to content</a>
    <header className="voice-header">
      <VoiceBrand />
      <nav className="voice-nav" aria-label="Primary navigation">{nav.map(([label, path]) => <NavLink key={path} to={path} end={path === '/'}>{label}</NavLink>)}</nav>
      <div className="voice-header-actions">
        {user ? <div className="voice-account"><button type="button" className="voice-account-toggle" aria-label="Account and care tools" aria-expanded={account} aria-controls="voice-account-menu" onClick={() => setAccount(!account)}><UserRound size={21} /></button>{account && <nav id="voice-account-menu" className="voice-account-menu" aria-label="Account tools"><strong>{user.child_name || user.full_name}</strong><Link to={user.role === 'admin' ? '/admin' : user.role === 'therapist' ? '/therapist' : '/dashboard'}>Care workspace <ArrowUpRight size={16} /></Link><Link to="/reports">Reports <ArrowUpRight size={16} /></Link><Link to="/profile">My profile <UserRound size={16} /></Link><Link to="/settings">Settings <Settings2 size={16} /></Link><button type="button" onClick={signOut}>Sign out <LogOut size={16} /></button></nav>}</div> : <Link className="voice-sign-in" to="/login">Sign in <ArrowUpRight size={17} /></Link>}
        <button className="voice-menu-toggle" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="voice-mobile-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && <nav className="voice-mobile-nav" id="voice-mobile-nav" aria-label="Mobile navigation">{nav.map(([label, path]) => <NavLink key={path} to={path} end={path === '/'}>{label}<ArrowUpRight size={18} /></NavLink>)}</nav>}
    </header>
    <main id="voice-main">{children}</main>
    {footer && <footer className="voice-footer"><VoiceBrand /><p>Learn. Listen. Speak. Grow.</p><div><Link to="/help">Help</Link><Link to="/about">About the project</Link><Link to="/credits">Voice & art credits</Link><Link to={user ? '/settings' : '/register'}>{user ? 'Your privacy' : 'Create account'}</Link><button type="button" className="voice-motion-toggle" aria-pressed={motionLevel !== 'full'} onClick={() => updatePreference('motionLevel', motionLevel === 'full' ? 'reduced' : 'full')}>{motionLevel === 'full' ? 'Reduce motion' : 'Enable motion'}</button></div><small>One sound at a time. Made for learning together.</small></footer>}
  </div>
}
