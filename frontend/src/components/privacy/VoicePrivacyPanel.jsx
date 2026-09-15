import { useEffect, useState } from 'react'
import {
  FlaskConical,
  HardDrive,
  Loader2,
  MonitorCheck,
  ShieldCheck,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { consentAPI } from '../../services/api'
import { normalizeConsent } from '../../features/consent/consentState'


const PURPOSES = [
  {
    id: 'recording_retention',
    label: 'Keep voice recordings',
    description: 'Optional. Raw recordings are otherwise deleted after scoring.',
    icon: HardDrive,
  },
  {
    id: 'clinician_sharing',
    label: 'Share results with the assigned therapist',
    description: 'Shares scores and practice history. Audio still requires recording retention.',
    icon: Users,
  },
  {
    id: 'deidentified_research',
    label: 'Use de-identified scores for research',
    description: 'Optional. Names, email and raw recordings are excluded.',
    icon: FlaskConical,
  },
]


export default function VoicePrivacyPanel() {
  const [state, setState] = useState(() => normalizeConsent())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    consentAPI.get()
      .then((response) => {
        if (active) setState(normalizeConsent(response.data))
      })
      .catch(() => {
        if (active) setError('Consent settings are temporarily unavailable.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const update = async (purpose, granted) => {
    setSaving(purpose)
    setError('')
    try {
      const response = await consentAPI.update({ purpose, granted, policy_version: '2026-08-30' })
      setState(normalizeConsent(response.data))
      toast.success('Voice privacy choice saved.')
    } catch {
      setError('That choice could not be saved. Your previous setting is unchanged.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <div className="flex min-h-24 items-center gap-3 text-sm text-slate-500" role="status"><Loader2 className="h-5 w-5 animate-spin" /> Loading voice privacy choices…</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-5 dark:border-teal-900 dark:bg-teal-950/20">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-teal-700 dark:bg-neutral-900 dark:text-teal-300">
          <MonitorCheck className="h-6 w-6" />
        </span>
        <div>
          <p className="font-bold text-slate-900 dark:text-white">Voice processing: edge preferred</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">A recording is used only for the selected speech attempt. Raw audio is transient unless you choose to keep it.</p>
        </div>
      </div>

      <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-neutral-700 dark:border-neutral-700">
        {PURPOSES.map(({ id, label, description, icon: Icon }) => (
          <div key={id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#1637b7] dark:text-blue-300" />
              <div>
                <label htmlFor={`consent-${id}`} className="font-semibold text-slate-900 dark:text-white">{label}</label>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
              </div>
            </div>
            <button
              id={`consent-${id}`}
              type="button"
              role="switch"
              aria-checked={state[id]}
              disabled={saving === id}
              onClick={() => update(id, !state[id])}
              className={`relative min-h-11 w-20 shrink-0 rounded-full border-2 px-1 outline-none transition focus-visible:ring-4 focus-visible:ring-[#f5a11a]/60 ${state[id] ? 'border-[#078a86] bg-[#078a86]' : 'border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800'}`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-full bg-white text-[10px] font-bold shadow-sm transition-transform ${state[id] ? 'translate-x-8 text-[#078a86]' : 'translate-x-0 text-slate-500'}`}>
                {saving === id ? <Loader2 className="h-4 w-4 animate-spin" /> : state[id] ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        ))}
      </div>

      <p className="flex items-start gap-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#078a86]" />
        You can change optional choices at any time. Account export and deletion remain available in Data &amp; Privacy.
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    </div>
  )
}
