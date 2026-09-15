import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Badge, Card, EmptyState, GradientButton, SectionTitle, StatCard } from '../components/ui'
import { calendarAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const localDate = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
const startDate = (event) => {
  const date = new Date(event.start)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function CalendarPage() {
  const userId = useAuthStore((state) => state.user?.id)
  const navigate = useNavigate()
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [formDate, setFormDate] = useState(() => localDate(today))
  const [formTime, setFormTime] = useState('09:00')
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['calendar-events', userId, year, month],
    queryFn: () => calendarAPI.listEvents({
      start: new Date(year, month, 1).toISOString(),
      end: new Date(year, month + 1, 1).toISOString(),
    }),
    enabled: Boolean(userId),
    retry: false,
  })

  const events = useMemo(() => (Array.isArray(data?.data?.events) ? data.data.events : [])
    .filter((event) => {
      const date = startDate(event)
      return date && date.getFullYear() === year && date.getMonth() === month
    }), [data, year, month])
  const byDay = useMemo(() => events.reduce((result, event) => {
    const day = startDate(event).getDate()
    if (!result[day]) result[day] = []
    result[day].push(event)
    return result
  }, {}), [events])
  const selectedEvents = byDay[selectedDay] || []
  const now = new Date()
  const counts = {
    total: events.length,
    upcoming: events.filter((event) => startDate(event) >= now && !event.done && event.status !== 'no_show').length,
    done: events.filter((event) => event.done).length,
    appointments: events.filter((event) => event.source === 'appointment' || event.type === 'appointment').length,
  }
  const grid = useMemo(() => {
    const cells = Array(new Date(year, month, 1).getDay()).fill(null)
    const lastDay = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= lastDay; day += 1) cells.push(day)
    while (cells.length % 7) cells.push(null)
    return cells
  }, [year, month])

  const changeMonth = (delta) => {
    setViewDate(new Date(year, month + delta, 1))
    setSelectedDay(1)
  }
  const saveEvent = async (event) => {
    event.preventDefault()
    const start = new Date(`${formDate}T${formTime}:00`)
    if (!title.trim() || Number.isNaN(start.getTime())) return
    setSaving(true)
    try {
      await calendarAPI.createEvent({ title: title.trim(), type: 'personal', start: start.toISOString() })
      setViewDate(new Date(start.getFullYear(), start.getMonth(), 1))
      setSelectedDay(start.getDate())
      setShowForm(false)
      setTitle('')
      await refetch()
      toast.success('Event added to your calendar')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not add the event')
    } finally {
      setSaving(false)
    }
  }
  const toggleDone = async (event) => {
    setUpdatingId(event.id)
    try {
      await calendarAPI.updateEvent(event.id, { done: !event.done })
      await refetch()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not update the event')
    } finally {
      setUpdatingId(null)
    }
  }

  return <DashboardLayout title="Therapy Calendar" subtitle="Your events and scheduled appointments" icon={CalendarDays}
    actions={<button type="button" onClick={() => { setFormDate(localDate(new Date(year, month, selectedDay))); setShowForm((value) => !value) }} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25"><Plus className="h-4 w-4" /> Add event</button>}>
    <div className="space-y-8">
      {showForm && <Card className="p-6"><form onSubmit={saveEvent} className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Event title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" /></label>
        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Date<input required type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" /></label>
        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Time<input required type="time" value={formTime} onChange={(event) => setFormTime(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" /></label>
        <GradientButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save event'}</GradientButton>
      </form></Card>}

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <StatCard icon={CalendarClock} title="This Month" value={isLoading || isError ? '—' : counts.total} color="primary" />
        <StatCard icon={Clock} title="Upcoming" value={isLoading || isError ? '—' : counts.upcoming} color="secondary" />
        <StatCard icon={CheckCircle2} title="Completed" value={isLoading || isError ? '—' : counts.done} color="accent" />
        <StatCard icon={CalendarDays} title="Appointments" value={isLoading || isError ? '—' : counts.appointments} color="gold" />
      </div>
      {isError && <Card className="p-6"><p role="alert" className="text-neutral-700 dark:text-neutral-200">Calendar events could not be loaded.</p><button type="button" onClick={() => refetch()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-600"><RefreshCw className="h-4 w-4" /> Retry</button></Card>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between gap-2"><h2 className="text-xl font-bold text-neutral-900 dark:text-white">{MONTHS[month]} {year}</h2><div className="flex items-center gap-2">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="rounded-xl p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today.getDate()) }} className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Today</button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="rounded-xl p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"><ChevronRight className="h-5 w-5" /></button>
          </div></div>
          <div className="mb-2 grid grid-cols-7 gap-1">{WEEKDAYS.map((day) => <div key={day} className="py-2 text-center text-[11px] font-bold uppercase text-neutral-500">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">{grid.map((day, index) => day === null ? <div key={`empty-${index}`} className="aspect-square" /> : <button key={day} type="button" onClick={() => setSelectedDay(day)} aria-label={`${MONTHS[month]} ${day}, ${year}, ${(byDay[day] || []).length} events`} aria-pressed={day === selectedDay} className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold sm:rounded-2xl ${day === selectedDay ? 'bg-primary-600 text-white' : year === today.getFullYear() && month === today.getMonth() && day === today.getDate() ? 'bg-primary-50 text-primary-700 ring-2 ring-primary-300 dark:bg-primary-900/30 dark:text-primary-300' : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}><span>{day}</span>{(byDay[day] || []).length > 0 && <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${day === selectedDay ? 'bg-white' : 'bg-primary-500'}`} />}</button>)}</div>
        </Card>
        <Card className="p-6"><SectionTitle title={`${MONTHS[month]} ${selectedDay}`} subtitle={`${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'}`} icon={CalendarClock} />
          {isLoading ? <p role="status" className="text-sm text-neutral-500">Loading calendar events…</p> : isError ? <p className="text-sm text-neutral-500">Event details are unavailable.</p> : selectedEvents.length === 0 ? <EmptyState icon={CalendarDays} title="No events" description="Nothing is scheduled for this day." /> : <div className="space-y-3">{selectedEvents.map((event) => {
            const appointment = event.source === 'appointment' || event.type === 'appointment'
            const label = appointment ? ({ pending: 'Pending session', confirmed: 'Confirmed session', completed: 'Completed session', no_show: 'Missed session' }[event.status] || 'Appointment') : event.done ? 'Done' : startDate(event) < now ? 'Past event' : 'Scheduled'
            return <div key={`${event.source || 'event'}-${event.id}`} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
              <div className="mb-2 flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-neutral-900 dark:text-white">{event.title}</h3><Badge color={event.done ? 'accent' : appointment ? 'primary' : 'neutral'}>{label}</Badge></div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">{event.all_day ? 'All day' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(startDate(event))}</p>
              {event.description && <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">{event.description}</p>}
              {appointment ? <button type="button" onClick={() => navigate('/appointments')} className="mt-3 text-xs font-semibold text-primary-600 dark:text-primary-300">Open appointments</button> : <button type="button" disabled={updatingId === event.id} onClick={() => toggleDone(event)} className="mt-3 text-xs font-semibold text-primary-600 disabled:opacity-50 dark:text-primary-300">{event.done ? 'Mark not done' : 'Mark done'}</button>}
            </div>
          })}</div>}
        </Card>
      </div>
    </div>
  </DashboardLayout>
}
