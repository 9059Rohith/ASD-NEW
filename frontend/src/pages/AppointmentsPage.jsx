import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CalendarClock, Clock, MapPin, Plus, RefreshCw, Stethoscope, Video, X } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Badge, Card, GradientButton, SectionTitle, StatCard } from '../components/ui'
import { appointmentsAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

const PAGE_SIZE = 20
const ACTIVE = new Set(['pending', 'confirmed'])
const emptyForm = { therapistId: '', date: '', time: '', duration: '30', mode: 'online', reason: '' }
const dateInput = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
const timeInput = (date) => [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join(':')
const appointmentDate = (appointment) => new Date(appointment.scheduled_at)
const readableDate = (date) => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
const readableTime = (date) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
const statusLabel = (status) => status === 'no_show' ? 'No show' : status || 'Unknown'

function LoadState({ loading, error, retry, empty, emptyText, children }) {
  if (loading) return <p role="status" className="rounded-2xl border border-neutral-100 p-6 text-sm text-neutral-500 dark:border-neutral-800">Loading appointments…</p>
  if (error) return <div className="rounded-2xl border border-neutral-100 p-6 dark:border-neutral-800"><p role="alert" className="text-sm text-neutral-600 dark:text-neutral-300">Appointments could not be loaded.</p><button type="button" onClick={retry} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-600"><RefreshCw className="h-4 w-4" /> Retry</button></div>
  if (empty) return <p className="rounded-2xl border border-neutral-100 p-6 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">{emptyText}</p>
  return children
}

export default function AppointmentsPage() {
  const user = useAuthStore((state) => state.user)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [activeNote, setActiveNote] = useState(null)
  const userId = user?.id
  const canBook = user?.role !== 'therapist'

  const upcomingQuery = useQuery({
    queryKey: ['appointments-upcoming', userId],
    queryFn: () => appointmentsAPI.list({ upcoming: true, page: 1, limit: 100 }),
    enabled: Boolean(userId),
    retry: false,
  })
  const historyQuery = useQuery({
    queryKey: ['appointments-page', userId, page],
    queryFn: () => appointmentsAPI.list({ page, limit: PAGE_SIZE }),
    enabled: Boolean(userId),
    retry: false,
  })
  const therapistQuery = useQuery({
    queryKey: ['available-therapists', userId],
    queryFn: appointmentsAPI.therapists,
    enabled: Boolean(userId),
    retry: false,
  })

  const upcoming = (Array.isArray(upcomingQuery.data?.data?.items) ? upcomingQuery.data.data.items : [])
    .filter((appointment) => ACTIVE.has(appointment.status) && appointmentDate(appointment) >= new Date())
  const records = Array.isArray(historyQuery.data?.data?.items) ? historyQuery.data.data.items : []
  const history = records.filter((appointment) => !ACTIVE.has(appointment.status) || appointmentDate(appointment) < new Date())
  const therapists = Array.isArray(therapistQuery.data?.data) ? therapistQuery.data.data : []
  const pages = historyQuery.data?.data?.pages || 0
  const total = historyQuery.data?.data?.total

  const refresh = async () => Promise.all([upcomingQuery.refetch(), historyQuery.refetch()])
  const openBooking = (therapistId = '') => {
    setEditing(null)
    setForm({ ...emptyForm, therapistId: therapistId || therapists[0]?.id || '' })
    setShowForm(true)
  }
  const openReschedule = (appointment) => {
    const date = appointmentDate(appointment)
    setEditing(appointment)
    setForm({
      therapistId: appointment.therapist_id,
      date: dateInput(date),
      time: timeInput(date),
      duration: String(appointment.duration_min || 30),
      mode: appointment.mode || 'online',
      reason: appointment.reason || '',
    })
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
  }
  const submit = async (event) => {
    event.preventDefault()
    const scheduledAt = new Date(`${form.date}T${form.time}:00`)
    if (!form.date || !form.time || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      toast.error('Choose a future date and time')
      return
    }
    if (!editing && !form.therapistId) {
      toast.error('Choose a therapist')
      return
    }
    setSubmitting(true)
    try {
      if (editing) {
        await appointmentsAPI.reschedule(editing.id, { scheduled_at: scheduledAt.toISOString(), duration_min: Number(form.duration) })
      } else {
        await appointmentsAPI.book({
          therapist_id: form.therapistId,
          scheduled_at: scheduledAt.toISOString(),
          duration_min: Number(form.duration),
          mode: form.mode,
          reason: form.reason.trim() || null,
        })
      }
      await refresh()
      closeForm()
      toast.success(editing ? 'Appointment rescheduled' : 'Appointment booked')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save the appointment')
    } finally {
      setSubmitting(false)
    }
  }
  const cancel = async (appointment) => {
    setCancellingId(appointment.id)
    try {
      await appointmentsAPI.cancel(appointment.id)
      await refresh()
      toast.success('Appointment cancelled')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not cancel the appointment')
    } finally {
      setCancellingId(null)
    }
  }

  return <DashboardLayout title="Appointments" subtitle="Book and manage real therapist sessions" icon={CalendarClock}
    actions={canBook && <button type="button" onClick={() => openBooking()} disabled={therapistQuery.isError || therapists.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary-600 shadow-md disabled:cursor-not-allowed disabled:opacity-60"><Plus className="h-4 w-4" /> Book New</button>}>
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <StatCard icon={CalendarClock} title="Upcoming Shown" value={upcomingQuery.isLoading || upcomingQuery.isError ? '—' : upcoming.length} color="primary" />
        <StatCard icon={CalendarCheck} title="Completed Here" value={historyQuery.isLoading || historyQuery.isError ? '—' : records.filter((item) => item.status === 'completed').length} color="accent" />
        <StatCard icon={Clock} title="Total Records" value={historyQuery.isLoading || historyQuery.isError ? '—' : total ?? 0} color="secondary" />
        <StatCard icon={Stethoscope} title="Therapists" value={therapistQuery.isLoading || therapistQuery.isError ? '—' : therapists.length} color="gold" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionTitle title="Upcoming Sessions" subtitle="Confirmed and pending appointments" icon={CalendarClock} />
          <LoadState loading={upcomingQuery.isLoading} error={upcomingQuery.isError} retry={upcomingQuery.refetch} empty={upcoming.length === 0} emptyText="No upcoming appointments are scheduled.">
            <div className="grid gap-4 sm:grid-cols-2">{upcoming.map((appointment) => {
              const date = appointmentDate(appointment)
              return <Card key={appointment.id} className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-neutral-900 dark:text-white">{appointment.therapist_name || 'Therapist'}</h3><p className="text-xs text-neutral-500">{appointment.child_name || appointment.user_name || 'Care session'}</p></div><Badge color={appointment.status === 'confirmed' ? 'accent' : 'primary'}>{appointment.status}</Badge></div>
                <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300"><CalendarClock className="h-4 w-4" /> {readableDate(date)} · {readableTime(date)}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">{appointment.mode === 'in_person' ? <MapPin className="h-4 w-4" /> : <Video className="h-4 w-4" />}{appointment.mode === 'in_person' ? 'In person' : 'Online'} · {appointment.duration_min || 30} min</p>
                {appointment.reason && <p className="mt-3 text-xs text-neutral-500">{appointment.reason}</p>}
                <div className="mt-4 flex gap-2"><button type="button" title="Reschedule" aria-label={`Reschedule with ${appointment.therapist_name || 'therapist'}`} onClick={() => openReschedule(appointment)} className="min-h-10 flex-1 rounded-xl bg-primary-50 px-3 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Reschedule</button><button type="button" title="Cancel" aria-label={`Cancel appointment with ${appointment.therapist_name || 'therapist'}`} disabled={cancellingId === appointment.id} onClick={() => cancel(appointment)} className="min-h-10 flex-1 rounded-xl bg-coral-50 px-3 text-xs font-semibold text-coral-700 disabled:opacity-50 dark:bg-coral-900/30">{cancellingId === appointment.id ? 'Cancelling…' : 'Cancel appointment'}</button></div>
              </Card>
            })}</div>
          </LoadState>
          {upcomingQuery.data?.data?.total > 100 && <p className="text-xs text-neutral-500">Showing the next 100 appointments.</p>}

          <Card className="p-6"><SectionTitle title="Appointment History" subtitle={`Page ${page} of ${pages || 1}`} icon={CalendarCheck} />
            <LoadState loading={historyQuery.isLoading} error={historyQuery.isError} retry={historyQuery.refetch} empty={history.length === 0} emptyText="No past or closed appointments on this page.">
              <div className="space-y-3">{history.map((appointment) => <div key={appointment.id} className="rounded-xl border border-neutral-100 p-4 dark:border-neutral-800">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-neutral-900 dark:text-white">{appointment.therapist_name || 'Therapist'}</strong><Badge color={appointment.status === 'completed' ? 'accent' : 'neutral'}>{statusLabel(appointment.status)}</Badge></div>
                <p className="mt-1 text-xs text-neutral-500">{readableDate(appointmentDate(appointment))} · {readableTime(appointmentDate(appointment))}</p>
                {appointment.note ? <button type="button" onClick={() => setActiveNote((id) => id === appointment.id ? null : appointment.id)} aria-expanded={activeNote === appointment.id} className="mt-2 min-h-10 text-xs font-semibold text-primary-600">View notes</button> : <p className="mt-2 text-xs text-neutral-500">No session notes recorded.</p>}
                {activeNote === appointment.id && appointment.note && <p role="status" className="mt-2 rounded-lg bg-primary-50 p-3 text-sm text-neutral-700 dark:bg-primary-900/20 dark:text-neutral-200">{appointment.note}</p>}
              </div>)}</div>
            </LoadState>
            {pages > 1 && <div className="mt-5 flex items-center justify-between"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="text-sm font-semibold text-primary-600 disabled:opacity-40">Previous page</button><span className="text-xs text-neutral-500">{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="text-sm font-semibold text-primary-600 disabled:opacity-40">Next page</button></div>}
          </Card>
        </div>

        <Card className="h-fit p-6"><SectionTitle title="Available Therapists" subtitle="Therapist accounts available for booking" icon={Stethoscope} />
          {therapistQuery.isLoading ? <p role="status" className="text-sm text-neutral-500">Loading therapists…</p> : therapistQuery.isError ? <div><p role="alert" className="text-sm text-neutral-600">Therapists could not be loaded.</p><button type="button" onClick={() => therapistQuery.refetch()} className="mt-2 text-sm font-semibold text-primary-600">Retry</button></div> : therapists.length === 0 ? <p className="text-sm text-neutral-500">No therapists are available for booking yet.</p> : <div className="space-y-3">{therapists.map((therapist) => <div key={therapist.id} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 p-3 dark:border-neutral-800"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-neutral-900 dark:text-white">{therapist.full_name}</h3><p className="text-xs text-neutral-500">Therapist</p></div>{canBook && <button type="button" onClick={() => openBooking(therapist.id)} className="min-h-10 rounded-lg bg-primary-50 px-3 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Book</button>}</div>)}</div>}
        </Card>
      </div>
    </div>

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="appointment-form-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-neutral-900">
      <div className="flex items-center justify-between bg-primary-700 px-6 py-5 text-white"><h2 id="appointment-form-title" className="text-lg font-bold">{editing ? 'Reschedule Appointment' : 'Book Appointment'}</h2><button type="button" onClick={closeForm} aria-label="Close appointment form" className="p-1"><X className="h-5 w-5" /></button></div>
      <form onSubmit={submit} className="space-y-4 p-6">
        {editing ? <p className="text-sm text-neutral-600 dark:text-neutral-300">With {editing.therapist_name || 'your therapist'}</p> : <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Therapist<select required value={form.therapistId} onChange={(event) => setForm({ ...form, therapistId: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.full_name}</option>)}</select></label>}
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800" /></label><label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Time<input required type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800" /></label></div>
        <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Duration (minutes)<input required type="number" min="10" max="180" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800" /></label>
        {!editing && <><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Session mode<select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"><option value="online">Online</option><option value="in_person">In person</option></select></label><label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Reason<textarea rows={3} maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800" /></label></>}
        <div className="flex gap-3"><button type="button" onClick={closeForm} className="min-h-11 flex-1 rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">Close</button><GradientButton type="submit" disabled={submitting} className="flex-1">{submitting ? 'Saving…' : editing ? 'Save New Time' : 'Confirm Booking'}</GradientButton></div>
      </form>
    </div></div>}
  </DashboardLayout>
}
