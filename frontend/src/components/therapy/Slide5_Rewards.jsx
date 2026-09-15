import { useEffect, useMemo, useState, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Coins, Home, RotateCcw, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTherapyStore } from '../../store/therapyStore'
import { progressAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { getFeedbackProfile } from '../../features/feedback/feedbackPolicy'
import CelebrationStage from '../feedback/CelebrationStage'
import toast from 'react-hot-toast'

const TOTAL_LESSONS = 16

export default function Slide5_Rewards({ lesson }) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const { sessionResults, resetSession } = useTherapyStore()
  const { user, updateUserStats } = useAuthStore()
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saveRetry, setSaveRetry] = useState(0)
  const savingRef = useRef(false)
  const latestResult = sessionResults[sessionResults.length - 1] || { accuracy: 0 }
  const earnedStars = latestResult.stars_earned ?? 0
  const profile = useMemo(() => getFeedbackProfile(latestResult.accuracy, lesson.id), [latestResult.accuracy, lesson.id])

  useEffect(() => {
    if (saved || savingRef.current || !latestResult.evaluation_receipt) return
    savingRef.current = true
    const saveProgress = async () => {
      try {
        await progressAPI.saveProgress({
          evaluation_receipt: latestResult.evaluation_receipt,
          lesson_id: lesson.id,
          phoneme: lesson.phoneme,
          lesson_type: lesson.type,
          accuracy: latestResult.accuracy,
          phoneme_match: latestResult.phoneme_match || false,
          mfcc_score: latestResult.mfcc_score || 0,
          gop_score: latestResult.gop_score || 0,
          airflow_score: latestResult.airflow_score || 0,
          feedback: latestResult.feedback || '',
          duration_ms: latestResult.duration_ms || 0,
        })
        // Refresh authoritative totals: an attempt may already have been saved.
        const summary = await progressAPI.getProgressSummary('me')
        if (user) updateUserStats({ total_stars: summary.data.total_stars, total_sessions: summary.data.total_sessions })
        setSaved(true)
        toast.success('Progress saved!')
      } catch (error) {
        setSaveError(true)
        console.error('Save error:', error)
      } finally {
        savingRef.current = false
      }
    }
    saveProgress()
  }, [latestResult, lesson, profile.stars, saved, saveRetry, updateUserStats, user])

  const restart = () => { resetSession(); window.location.reload() }
  const next = () => {
    if (lesson.id < TOTAL_LESSONS) navigate(`/therapy/${lesson.id + 1}`)
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 md:p-8 relative overflow-hidden bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100">
      <CelebrationStage accuracy={latestResult.accuracy} active reducedMotion={reducedMotion} />
      <motion.main initial={{ opacity: 0, y: 24, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-30 max-w-4xl w-full bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white p-6 md:p-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 text-violet-700 px-4 py-2 text-sm font-extrabold mb-4"><Sparkles className="w-4 h-4" /> Lesson complete</div>
        <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight">{profile.heading}</h1>
        <p className="mt-3 text-lg md:text-2xl text-slate-600 font-semibold">{latestResult.feedback || 'Thank you for practising.'}</p>

        {saveError && !saved && <p role="alert" className="mt-4 text-amber-800">Progress could not be saved. <button className="underline" onClick={() => { setSaveError(false); setSaveRetry(value => value + 1) }}>Retry saving</button></p>}
        <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Your rewards">
          <Reward value={lesson.symbol} label="Tamil lesson" />
          <Reward value={`${Math.round(latestResult.accuracy)}%`} label="Accuracy" />
          <Reward value={`${'★'.repeat(earnedStars)}${'☆'.repeat(3 - earnedStars)}`} label={`${earnedStars} stars earned`} gold />
          <Reward value={`${latestResult.correct_phonemes ?? 0}/${latestResult.total_phonemes ?? 0}`} label="Sounds matched" />
        </section>

        <div className="mt-7 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 p-[2px]">
          <div className="rounded-[14px] bg-white px-5 py-4 text-slate-700 font-semibold">Every try grows your Tamil voice. Your next practice will feel even easier.</div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <button onClick={restart} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border-2 border-violet-200 text-violet-700 hover:bg-violet-50 font-bold"><RotateCcw className="w-5 h-5" /> Try again</button>
          <button onClick={next} className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg font-bold">{lesson.id < TOTAL_LESSONS ? 'Next lesson' : 'Finish'} <ArrowRight className="w-5 h-5" /></button>
          <button onClick={() => navigate('/dashboard')} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"><Home className="w-5 h-5" /> Dashboard</button>
        </div>
      </motion.main>
    </div>
  )
}

function Reward({ value, label, gold = false }) {
  return <motion.div initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-2xl p-4 border ${gold ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-800'}`}><div className="min-h-9 flex justify-center items-center text-2xl md:text-3xl font-black">{value}</div><div className="mt-1 text-xs font-bold opacity-70">{label}</div></motion.div>
}
