import { useEffect, useState } from 'react'
import { ArrowLeft, LockKeyhole, Mail, Stethoscope, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { therapistAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import {
  buildClinicianRegistrationPayload,
  validateClinicianRegistration,
} from '../features/onboarding/clinicianRegistration'
import { homeForRole } from '../utils/roleRouting'


const EMPTY_FORM = { fullName: '', email: '', password: '', confirmPassword: '' }


export default function ClinicianRegisterPage() {
  const navigate = useNavigate()
  const { authReady, isAuthenticated, setAuth, user } = useAuthStore()
  const [values, setValues] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authReady && isAuthenticated && user) navigate(homeForRole(user.role), { replace: true })
  }, [authReady, isAuthenticated, navigate, user])

  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const validationMessage = validateClinicianRegistration(values)
    if (validationMessage) {
      toast.error(validationMessage)
      return
    }
    setSubmitting(true)
    try {
      const response = await therapistAPI.register(buildClinicianRegistrationPayload(values))
      setAuth(response.data.user, response.data.access_token)
      toast.success('Therapist workspace created.')
      navigate('/therapist', { replace: true })
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create the therapist account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#08194f]">
      <div className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden border-r border-slate-200 bg-[#f7f9fd] px-12 py-14 lg:flex lg:flex-col lg:justify-between">
          <Link to="/" className="inline-flex items-center gap-3 text-lg font-bold text-[#08194f]">
            <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[#1637b7] font-['Noto_Sans_Tamil'] text-2xl text-[#1637b7]">அ</span>
            ASD-Edge-ST
          </Link>
          <div className="max-w-md">
            <Stethoscope className="mb-6 h-12 w-12 text-[#1637b7]" strokeWidth={1.8} />
            <h1 className="text-4xl font-bold leading-tight">A focused workspace for Tamil speech review.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Review assigned children, inspect phoneme evidence, and share one clear next-practice cue with caregivers.
            </p>
          </div>
          <p className="text-sm leading-6 text-slate-500">Sree Taarikaa School · Team 96 clinical collaboration</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-lg">
            <Link to="/register" className="mb-10 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1637b7] underline-offset-4 hover:underline">
              <ArrowLeft className="h-4 w-4" /> Parent / caregiver registration
            </Link>
            <h2 className="text-3xl font-bold sm:text-4xl">Create therapist account</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">Use your professional account to manage an assigned caseload.</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <Field icon={UserRound} label="Full name" value={values.fullName} onChange={update('fullName')} autoComplete="name" />
              <Field icon={Mail} label="Work email" type="email" value={values.email} onChange={update('email')} autoComplete="email" />
              <Field icon={LockKeyhole} label="Password" type="password" value={values.password} onChange={update('password')} autoComplete="new-password" />
              <Field icon={LockKeyhole} label="Confirm password" type="password" value={values.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
              <p className="text-sm leading-6 text-slate-500">
                Production deployments should verify therapist identities before assigning children.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-14 w-full rounded-xl bg-[#1637b7] px-5 text-base font-bold text-white outline-none transition hover:bg-[#102d98] focus-visible:ring-4 focus-visible:ring-[#f5a11a]/70 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Create therapist account'}
              </button>
            </form>
            <p className="mt-7 text-center text-sm text-slate-600">
              Already registered? <Link to="/login" className="font-semibold text-[#1637b7] underline">Sign in</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}


function Field({ icon: Icon, label, type = 'text', value, onChange, autoComplete }) {
  const id = `clinician-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#08194f]">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          required
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="min-h-14 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base text-[#08194f] outline-none transition focus:border-[#1637b7] focus:ring-4 focus:ring-[#1637b7]/10"
        />
      </div>
    </div>
  )
}
