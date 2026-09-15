import { lazy, Suspense, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTherapyStore } from '../../store/therapyStore'
import Slide1_Picture from './Slide1_Picture'
const Slide2_Animation = lazy(() => import('./Slide2_Animation'))
const Slide3_Evaluation = lazy(() => import('./Slide3_Evaluation'))
const Slide4_CandleTest = lazy(() => import('./Slide4_CandleTest'))
const Slide5_Rewards = lazy(() => import('./Slide5_Rewards'))

// Per-slide ambient background tint (mega-prompt: each slide breathes its own colour)
const SLIDE_THEME = {
  1: { tint: 'from-sky-50 via-blue-50 to-indigo-50', label: 'Today\'s Word', accent: 'from-blue-500 to-indigo-500' },
  2: { tint: 'from-violet-50 via-purple-50 to-fuchsia-50', label: 'Watch & Listen', accent: 'from-violet-500 to-purple-500' },
  3: { tint: 'from-emerald-50 via-green-50 to-teal-50', label: 'Your Turn!', accent: 'from-emerald-500 to-teal-500' },
  4: { tint: 'from-amber-50 via-orange-50 to-yellow-50', label: 'Candle Breath Test', accent: 'from-amber-500 to-orange-500' },
  5: { tint: 'from-fuchsia-50 via-pink-50 to-rose-50', label: 'Your Reward', accent: 'from-fuchsia-500 to-pink-500' },
}

export default function SlideManager({ lesson }) {
  const navigate = useNavigate()
  const { currentSlide, prevSlide, nextSlide, setCurrentSlide, resetSession } = useTherapyStore()
  const [showExitModal, setShowExitModal] = useState(false)

  // Letters skip the candle test (slide 4); words include all slides
  const slides = lesson.type === 'letter' ? [1, 2, 3, 5] : [1, 2, 3, 4, 5]
  const stepIndex = Math.max(0, slides.indexOf(currentSlide))
  const totalSteps = slides.length
  const theme = SLIDE_THEME[currentSlide] || SLIDE_THEME[1]

  const handleExit = () => {
    resetSession()
    navigate('/dashboard')
  }

  const renderSlide = () => {
    switch (currentSlide) {
      case 1:
        return <Slide1_Picture lesson={lesson} onNext={nextSlide} />
      case 2:
        return <Slide2_Animation lesson={lesson} onNext={nextSlide} onPrev={prevSlide} />
      case 3:
        return <Slide3_Evaluation lesson={lesson} onNext={nextSlide} onPrev={prevSlide} />
      case 4:
        if (lesson.type === 'word') {
          return <Slide4_CandleTest lesson={lesson} onNext={nextSlide} onPrev={prevSlide} />
        }
        return <Slide5_Rewards lesson={lesson} />
      case 5:
        return <Slide5_Rewards lesson={lesson} />
      default:
        return <Slide1_Picture lesson={lesson} onNext={nextSlide} />
    }
  }

  return (
    <div className={`min-h-screen overflow-x-clip bg-gradient-to-br ${theme.tint} transition-colors duration-700`}>
      {/* ── Top training bar ── */}
      <div className="bg-white/70 backdrop-blur-xl shadow-sm border-b border-white/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Lesson chip */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-3.5 py-1.5 rounded-full">
                <span className="tamil-letter font-bold text-primary text-lg leading-none">{lesson.symbol}</span>
                <span className="font-semibold text-primary text-sm hidden sm:inline">{lesson.english}</span>
              </div>
              <div className="hidden md:flex items-center gap-0.5">
                {[...Array(lesson.difficulty)].map((_, i) => (
                  <span key={i} className="text-gold-400 text-lg">★</span>
                ))}
              </div>
            </div>

            {/* Step label */}
            <div className="hidden sm:flex flex-col items-center leading-tight">
              <span className={`text-sm font-bold bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                {theme.label}
              </span>
              <span className="text-[11px] text-neutral-500 font-medium">
                Slide {stepIndex + 1} of {totalSteps}
              </span>
            </div>

            {/* Exit */}
            <button
              onClick={() => setShowExitModal(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-neutral-500 hover:text-coral-600 hover:bg-coral-50 transition font-medium text-sm"
              aria-label="Exit session"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>

          {/* Segmented progress bar */}
          <div className="flex items-center gap-2 mt-3">
            {slides.map((slideNum, i) => {
              const done = i < stepIndex
              const current = i === stepIndex
              return (
                <button
                  key={slideNum}
                  onClick={() => i <= stepIndex && setCurrentSlide(slideNum)}
                  disabled={i > stepIndex}
                  className="relative flex-1 h-2.5 rounded-full bg-neutral-200/80 overflow-hidden disabled:cursor-not-allowed"
                  aria-label={`Go to slide ${i + 1}`}
                >
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${theme.accent}`}
                    initial={false}
                    animate={{ width: done ? '100%' : current ? '55%' : '0%' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  {current && (
                    <motion.div
                      className={`absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r ${theme.accent}`}
                      animate={{ opacity: [0.35, 0.7, 0.35] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Slide content ── */}
      <div className="training-session-layout" data-testid="training-session-layout">
        <section className="training-session-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -80 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="min-h-[calc(100vh-92px)]"
            >
              <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-neutral-600" role="status">Loading lesson step…</div>}>
                {renderSlide()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      {/* ── Exit confirmation modal ── */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => setShowExitModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-premium-lg p-8 max-w-sm w-full text-center"
            >
              <div className="text-5xl mb-3">👋</div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Leave this lesson?</h3>
              <p className="text-neutral-500 text-sm mb-6">
                Your progress on this slide won&apos;t be saved. You can start the lesson again anytime.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-neutral-200 text-neutral-700 font-semibold hover:border-primary-300 hover:text-primary-600 transition"
                >
                  Keep Going
                </button>
                <button
                  onClick={handleExit}
                  className="flex-1 py-3 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-semibold transition inline-flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Exit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
