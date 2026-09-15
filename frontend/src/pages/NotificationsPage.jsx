import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell, Trophy, CalendarClock, AlarmClock, MessageSquare, Sparkles,
  CheckCheck, X, BellOff, Mail, Smartphone, Volume2, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, SectionTitle, EmptyState } from '../components/ui'
import { useAuthStore } from '../store/authStore'
import { notificationsAPI, settingsAPI } from '../services/api'

const PAGE_SIZE = 20
const META = {
  achievement: { icon: Trophy, color: 'from-gold-400 to-amber-500' },
  appointment: { icon: CalendarClock, color: 'from-primary-500 to-indigo-600' },
  reminder: { icon: AlarmClock, color: 'from-secondary-500 to-cyan-600' },
  social: { icon: MessageSquare, color: 'from-accent-500 to-emerald-600' },
  progress: { icon: Trophy, color: 'from-gold-400 to-amber-500' },
  system: { icon: Bell, color: 'from-primary-500 to-secondary-500' },
}
const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' },
  { key: 'achievement', label: 'Achievements' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'reminder', label: 'Reminders' },
]

function dateOf(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isToday(value) {
  const date = dateOf(value)
  const today = new Date()
  return Boolean(date) && date.toDateString() === today.toDateString()
}

function Toggle({ on, onChange, label, disabled }) {
  return <button type="button" onClick={onChange} disabled={disabled} aria-label={label} aria-pressed={on}
    className={'relative h-11 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 '
      + (on ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700')}>
    <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={'absolute top-3 h-5 w-5 rounded-full bg-white shadow ' + (on ? 'left-[22px]' : 'left-0.5')} />
  </button>
}

function NotificationRow({ item, onRead, onDismiss, pending }) {
  const meta = META[item.category] || META.system
  const Icon = meta.icon
  const date = dateOf(item.created_at)
  const link = typeof item.link === 'string' && item.link.startsWith('/') && !item.link.startsWith('//')
    ? item.link : null
  return <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    aria-label={item.title}
    className={'flex items-start gap-4 rounded-2xl border p-4 transition hover:shadow-md '
      + (item.read
        ? 'border-neutral-100 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-800/30'
        : 'border-primary-100 bg-white shadow-sm dark:border-primary-900/40 dark:bg-neutral-900')}>
    <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ' + meta.color}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <h3 className={'text-sm ' + (item.read
          ? 'font-semibold text-neutral-600 dark:text-neutral-300'
          : 'font-bold text-neutral-900 dark:text-white')}>{item.title}</h3>
        {!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-coral-500" aria-label="Unread" />}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{item.body}</p>
      {date && <time dateTime={item.created_at} className="mt-1.5 inline-block text-[11px] text-neutral-400">
        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}
      </time>}
      {link && <Link to={link} onClick={() => { if (!item.read) onRead(item.id) }}
        className="mt-2 block w-fit text-sm font-semibold text-primary-600 hover:underline dark:text-primary-300">
        View update
      </Link>}
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">
      {!item.read && <button type="button" disabled={pending} onClick={() => onRead(item.id)}
        className="min-h-11 rounded-lg px-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:text-primary-300">
        Mark read
      </button>}
      <button type="button" disabled={pending} onClick={() => onDismiss(item.id)} aria-label="Dismiss" title="Dismiss"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-coral-50 hover:text-coral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500 disabled:opacity-50 dark:hover:bg-coral-900/30">
        <X className="h-4 w-4" />
      </button>
    </div>
  </motion.article>
}

export default function NotificationsPage() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingPreference, setPendingPreference] = useState(null)
  const list = useQuery({
    queryKey: ['notifications', userId, filter, page],
    queryFn: () => notificationsAPI.list({
      page, limit: PAGE_SIZE,
      ...(filter === 'unread' ? { unread_only: true } : {}),
      ...(!['all', 'unread'].includes(filter) ? { category: filter } : {}),
    }),
    enabled: Boolean(userId), retry: false,
  })
  const unread = useQuery({
    queryKey: ['notifications-unread', userId],
    queryFn: () => notificationsAPI.unreadCount(),
    enabled: Boolean(userId), retry: false,
  })
  const preferences = useQuery({
    queryKey: ['notification-settings', userId],
    queryFn: () => settingsAPI.get(),
    enabled: Boolean(userId), retry: false,
  })
  const envelope = list.data?.data
  const items = Array.isArray(envelope?.items) ? envelope.items : []
  const unreadCount = Number.isFinite(unread.data?.data?.unread) ? unread.data.data.unread : null
  const settings = preferences.data?.data
  const pages = Number(envelope?.pages) || 0

  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
    queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] }),
  ])
  const changeNotification = async (key, request, success) => {
    setPendingAction(key)
    try {
      await request()
      await refresh()
      toast.success(success)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not update notifications')
    } finally {
      setPendingAction(null)
    }
  }
  const togglePreference = async (key) => {
    if (!settings) return
    const current = key === 'sound' ? settings.sound_enabled : settings.notifications?.[key]
    const payload = key === 'sound' ? { sound_enabled: !current } : { notifications: { [key]: !current } }
    setPendingPreference(key)
    try {
      await settingsAPI.update(payload)
      await queryClient.invalidateQueries({ queryKey: ['notification-settings', userId] })
      toast.success('Preference saved')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save preference')
    } finally {
      setPendingPreference(null)
    }
  }
  const renderGroup = (label, group) => group.length > 0 && <section aria-label={label}>
    <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</h2>
    <div className="space-y-2.5">
      {group.map((item) => <NotificationRow key={item.id} item={item} pending={Boolean(pendingAction)}
        onRead={(id) => changeNotification(id, () => notificationsAPI.markRead(id), 'Marked as read')}
        onDismiss={(id) => changeNotification(id, () => notificationsAPI.remove(id), 'Notification dismissed')} />)}
    </div>
  </section>

  return <DashboardLayout title="Notifications"
    subtitle={unreadCount === null ? 'Your updates' : `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`}
    icon={Bell}
    actions={<button type="button" disabled={!unreadCount || Boolean(pendingAction)}
      onClick={() => changeNotification('all', () => notificationsAPI.markAllRead(), 'All marked as read')}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-50">
      <CheckCheck className="h-4 w-4" /> Mark all read
    </button>}>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex flex-wrap gap-2" aria-label="Notification filters">
          {FILTERS.map((option) => <button type="button" key={option.key}
            onClick={() => { setFilter(option.key); setPage(1) }} aria-pressed={filter === option.key}
            className={'min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition '
              + (filter === option.key
                ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md shadow-primary-500/25'
                : 'border border-neutral-100 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800')}>
            {option.label}
            {option.key === 'unread' && unreadCount > 0 && <span className="ml-1.5 rounded-full bg-coral-100 px-1.5 py-0.5 text-[10px] text-coral-600">{unreadCount}</span>}
          </button>)}
        </div>
        {list.isPending ? <Card className="p-6"><p role="status">Loading notifications…</p></Card>
          : list.isError ? <Card className="p-6">
            <p>Notifications could not be loaded.</p>
            <button type="button" onClick={() => list.refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-primary-600">
              <RefreshCw className="h-4 w-4" /> Retry notifications
            </button>
          </Card>
            : items.length === 0 ? <Card className="p-4">
              <EmptyState icon={BellOff} title={filter === 'unread' ? 'No unread updates' : "You're all caught up"}
                description="There are no notifications in this filter. Check back later for new updates." />
            </Card>
              : <div className="space-y-7">
                {renderGroup('Today', items.filter((item) => isToday(item.created_at)))}
                {renderGroup('Earlier', items.filter((item) => !isToday(item.created_at)))}
              </div>}
        {pages > 1 && <nav aria-label="Notification pages" className="flex items-center justify-between gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}
            className="min-h-11 rounded-lg px-3 font-semibold text-primary-600 disabled:opacity-50">Previous page</button>
          <span className="text-sm text-neutral-500">Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}
            className="min-h-11 rounded-lg px-3 font-semibold text-primary-600 disabled:opacity-50">Next page</button>
        </nav>}
      </div>
      <div className="space-y-6">
        <Card className="p-6" delay={0.1}>
          <SectionTitle title="Preferences" subtitle="Save your update choices" icon={Sparkles} />
          {preferences.isPending ? <p role="status">Loading preferences…</p>
            : preferences.isError ? <div>
              <p>Preferences could not be loaded.</p>
              <button type="button" onClick={() => preferences.refetch()}
                className="mt-3 min-h-11 rounded-lg px-3 font-semibold text-primary-600">Retry preferences</button>
            </div>
              : <div className="space-y-4">
                {[
                  { key: 'email', label: 'Email Alerts', desc: 'Email update preference', icon: Mail },
                  { key: 'push', label: 'Push Notifications', desc: 'Device update preference', icon: Smartphone },
                  { key: 'sound', label: 'App Sounds', desc: 'Sound effects across the app', icon: Volume2 },
                ].map((option) => {
                  const Icon = option.icon
                  const enabled = option.key === 'sound' ? settings.sound_enabled : settings.notifications?.[option.key]
                  return <div key={option.key} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
                      <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{option.label}</div>
                      <div className="text-xs text-neutral-400">{option.desc}</div>
                    </div>
                    <Toggle on={Boolean(enabled)} onChange={() => togglePreference(option.key)}
                      disabled={Boolean(pendingPreference)} label={option.label + ' notifications'} />
                  </div>
                })}
              </div>}
        </Card>
        <Card className="border-0 bg-gradient-to-br from-primary-500 to-secondary-500 p-6" delay={0.2}>
          <Trophy className="mb-3 h-8 w-8 text-white/90" />
          <h2 className="text-lg font-bold text-white">Stay motivated</h2>
          <p className="mt-1 text-sm text-white/80">
            Practice updates for {user?.child_name || 'your child'} appear here when they are available.
          </p>
        </Card>
      </div>
    </div>
  </DashboardLayout>
}
