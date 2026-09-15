import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, GraduationCap, BookOpen, Video, Mic, ScanFace, ClipboardCheck,
  Gamepad2, BarChart3, FileText, Trophy, Gift, Calendar, Bell, Users,
  Stethoscope, CalendarClock, User, Settings, HelpCircle, MessageSquarePlus,
  Info, LogOut, Search, Moon, Sun, Menu, X, Star, ChevronLeft, Sparkles,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { authAPI } from '../../services/api'
import { navGroupsForRole } from '../../utils/roleRouting'
import toast from 'react-hot-toast'
import '../../styles/vowel-world.css'
import '../../styles/responsive-backgrounds.css'

// Grouped navigation — the full information architecture of the platform
export const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { icon: Home, label: 'Overview', path: '/dashboard' },
      { icon: Mic, label: 'Vowel Studio', path: '/practice' },
      { icon: ClipboardCheck, label: 'Evaluate vowels', path: '/evaluate' },
      { icon: GraduationCap, label: 'Learn Tamil', path: '/tamil' },
      { icon: Sparkles, label: 'Play & Practice', path: '/play' },
      { icon: ClipboardCheck, label: 'Assessment', path: '/assessment' },
    ],
  },
  {
    title: 'Learning',
    items: [
      { icon: BookOpen, label: 'Letter Learning', path: '/letter-learning' },
      { icon: Video, label: 'Training Videos', path: '/videos' },
      { icon: Mic, label: 'Speech Analysis', path: '/speech-analysis' },
      { icon: ScanFace, label: 'Tongue Tracking', path: '/tongue-tracking' },
      { icon: Gamepad2, label: 'Games', path: '/games' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { icon: BarChart3, label: 'Progress', path: '/progress' },
      { icon: FileText, label: 'Reports', path: '/reports' },
      { icon: Trophy, label: 'Achievements', path: '/achievements' },
      { icon: Gift, label: 'Rewards', path: '/rewards' },
    ],
  },
  {
    title: 'Community',
    items: [
      { icon: Calendar, label: 'Calendar', path: '/calendar' },
      { icon: Bell, label: 'Notifications', path: '/notifications' },
      { icon: Users, label: 'Care team', path: '/parent' },
      { icon: Stethoscope, label: 'Caseload', path: '/therapist' },
      { icon: CalendarClock, label: 'Appointments', path: '/appointments' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: User, label: 'Profile', path: '/profile' },
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: HelpCircle, label: 'Help & Support', path: '/help' },
      { icon: MessageSquarePlus, label: 'Feedback', path: '/feedback' },
      { icon: Info, label: 'About', path: '/about' },
    ],
  },
]

function SidebarContent({ onNavigate, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const navGroups = navGroupsForRole(NAV_GROUPS, user?.role)

  const go = (path) => {
    navigate(path)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex min-h-20 items-center justify-between border-b border-[#d9ddcb] px-5 py-4 dark:border-neutral-800">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => go('/')}>
          <div className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[#143c31] font-['Noto_Sans_Tamil'] text-2xl font-bold text-[#143c31] dark:border-blue-300 dark:text-blue-300">
            அ
          </div>
          <div>
            <div className="text-base font-bold text-[#143c31] dark:text-white">ASD-Edge-ST</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close care navigation" className="lg:hidden p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-8 scrollbar-thin" aria-label="Primary">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="sr-only">{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((link) => {
                const active = location.pathname === link.path || (link.path === '/play' && location.pathname.startsWith('/play/'))
                return (
                  <button
                    key={link.path}
                    onClick={() => go(link.path)}
                    className={`group relative flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-[16px] font-medium outline-none transition-all focus-visible:ring-4 focus-visible:ring-[#f5a11a]/50 ${
                      active
                        ? 'bg-[#e7edda] text-[#143c31] before:absolute before:-left-3 before:h-9 before:w-1 before:rounded-r before:bg-[#143c31] dark:bg-blue-950/30 dark:text-blue-300'
                        : 'text-[#435642] hover:bg-white dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <link.icon className={`w-[18px] h-[18px] shrink-0 ${active ? '' : 'group-hover:scale-110 transition-transform'}`} />
                    <span className="truncate">{link.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

/**
 * DashboardLayout — shared shell for every authenticated page.
 * Props:
 *   title, subtitle  — header text (rendered in the gradient banner)
 *   icon             — lucide icon component for the header
 *   actions          — optional React node rendered on the right of the header
 *   children         — page content
 *   maxWidth         — tailwind max-w utility (default max-w-7xl)
 */
export default function DashboardLayout({ title, subtitle, icon: Icon, actions, children, maxWidth = 'max-w-7xl', variant = 'default' }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { darkMode, toggleDarkMode } = useSettingsStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const quietShell = variant === 'care' || user?.role === 'therapist'
  const allItems = useMemo(
    () => navGroupsForRole(NAV_GROUPS, user?.role).flatMap((group) => group.items),
    [user?.role],
  )

  const results = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return allItems.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6)
  }, [allItems, search])

  const handleLogout = async () => {
    try { await authAPI.logout() } catch { /* ignore */ }
    logout()
    navigate('/')
    toast.success('Logged out successfully')
  }

  return (
    <div className="care-world min-h-screen bg-[#f8f5ec] dark:bg-neutral-950 transition-colors">
      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[252px] flex-col border-r border-[#d9ddcb] bg-[#f0f1e6] dark:border-neutral-800 dark:bg-neutral-900 lg:flex">
        <SidebarContent />
        <div className="p-3 border-t border-neutral-100 dark:border-neutral-800">
          <button onClick={handleLogout} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-red-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-neutral-900 border-r border-neutral-100 dark:border-neutral-800 z-50 flex flex-col"
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
              <div className="p-3 border-t border-neutral-100 dark:border-neutral-800">
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-medium text-sm">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="min-h-screen flex flex-col lg:ml-[252px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-[#d9ddcb] bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex h-20 items-center gap-3 px-4 sm:px-8">
            <button onClick={() => setMobileOpen(true)} aria-label="Open care navigation" className="lg:hidden p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>

            {/* Search */}
            {!quietShell && <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowResults(true) }}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                placeholder="Search pages, lessons, reports…"
                className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-400 border border-transparent focus:border-primary-300 focus:bg-white dark:focus:bg-neutral-900 outline-none transition"
              />
              <AnimatePresence>
                {showResults && results.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-premium border border-neutral-100 dark:border-neutral-800 p-2 z-50"
                  >
                    {results.map((r) => (
                      <button
                        key={r.path}
                        onMouseDown={() => { navigate(r.path); setSearch('') }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                      >
                        <r.icon className="w-4 h-4 text-primary-500" />
                        {r.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>}

            <div className="flex items-center gap-2 ml-auto">
              {quietShell && <span className="hidden text-base font-medium text-[#143c31] dark:text-white sm:inline">{user?.role === 'therapist' ? 'Therapist view' : 'Parent view'}</span>}
              {!quietShell && <button onClick={toggleDarkMode} className="p-2.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition" title="Toggle theme">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>}
              {!quietShell && <button onClick={() => navigate('/notifications')} className="relative p-2.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition" title="Notifications">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-coral-500 rounded-full ring-2 ring-white dark:ring-neutral-900" />
              </button>}
              <button onClick={() => navigate('/profile')} className="flex min-h-11 items-center gap-2 rounded-xl pl-1.5 pr-3 outline-none transition hover:bg-[#f0f1e6] focus-visible:ring-4 focus-visible:ring-[#f5a11a]/50 dark:hover:bg-neutral-800">
                <div className="grid h-9 w-9 place-items-center rounded-full border border-[#d9ddcb] bg-[#e7edda] text-sm font-bold text-[#143c31]">
                  {user?.child_name?.charAt(0) || user?.full_name?.charAt(0) || 'U'}
                </div>
                <span className="hidden sm:block text-sm font-semibold text-neutral-700 dark:text-neutral-200 max-w-[120px] truncate">{user?.child_name || user?.full_name || 'Guest'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page header banner */}
        {(title || actions) && (
          <div className="border-b border-[#d9ddcb] bg-white px-4 py-7 text-[#143c31] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white sm:px-8">
            <div className={`${maxWidth} mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
              <div className="flex items-center gap-4">
                {Icon && (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d9ddcb] bg-[#e7edda] text-[#143c31] dark:border-neutral-700 dark:bg-neutral-800 dark:text-blue-300">
                    <Icon className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
                  {subtitle && <p className="mt-1 text-sm text-[#63705b] dark:text-neutral-400">{subtitle}</p>}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          </div>
        )}

        {/* Content */}
        <main className={`flex-1 px-4 sm:px-8 ${variant === 'care' ? 'py-8 lg:py-10' : 'py-8'}`}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`${maxWidth} mx-auto`}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
