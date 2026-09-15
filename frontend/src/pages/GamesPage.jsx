import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Gamepad2, Play, Trophy, Target, Zap,
} from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, SectionTitle, Badge, GradientButton } from '../components/ui'
import toast from 'react-hot-toast'
import { TAMIL_VOWELS } from '../features/training/tamilCurriculum'

const GAMES = [
  { name: 'Alphabet Match', emoji: '🔤', grad: 'from-primary-500 to-indigo-600', description: 'Match a written vowel name to its Tamil letter.', path: '/games/alphabet#alphabet-match' },
  { name: 'Breath Balloon', emoji: '🎈', grad: 'from-coral-500 to-rose-600', description: 'Guide a balloon with microphone input or the practice controls.', path: '/play/arcade/breath-balloon' },
  { name: 'Mouth Mirror', emoji: '🪞', grad: 'from-secondary-500 to-cyan-600', description: 'Follow mouth-shape guides with a camera mirror.', path: '/play/mouth-mirror' },
  { name: 'Letter Learning', emoji: '📖', grad: 'from-gold-400 to-amber-500', description: 'Explore Tamil letters and their example sounds.', path: '/letter-learning' },
  { name: 'Kavi’s River Rescue', emoji: '🗣️', grad: 'from-accent-500 to-emerald-600', description: 'Listen to a Tamil story and practise its spoken lines.', path: '/play/quest/river-rescue' },
  { name: 'Vowel Games', emoji: '🎤', grad: 'from-violet-500 to-purple-600', description: 'Explore six speaking and listening games in the Vowel Studio.', path: '/games' },
]

const TAMIL = TAMIL_VOWELS

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

function buildRound() {
  const pool = shuffle(TAMIL)
  const target = pool[0]
  const options = shuffle([target, ...pool.slice(1, 4)])
  return { target, options }
}

export default function GamesPage() {
  const navigate = useNavigate()
  const alphabetGameRef = useRef(null)
  const [round, setRound] = useState(buildRound)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [shakeId, setShakeId] = useState(null)

  const openGame = (game) => {
    if (game.path === '/games/alphabet#alphabet-match') {
      navigate(game.path)
      requestAnimationFrame(() => {
        alphabetGameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        alphabetGameRef.current?.focus({ preventScroll: true })
      })
      return
    }
    navigate(game.path)
  }

  const choose = (opt) => {
    if (opt.tamil === round.target.tamil) {
      setScore((s) => s + 10)
      setStreak((s) => s + 1)
      toast.success(`🎉 Correct! +10 points`)
      setRound(buildRound())
    } else {
      setStreak(0)
      setShakeId(opt.tamil)
      setTimeout(() => setShakeId(null), 500)
      toast('Take another look and try again.')
    }
  }

  return (
    <DashboardLayout
      title="Alphabet & Playroom"
      subtitle="Match Tamil letters and explore your favourite practice activities"
      icon={Gamepad2}
    >
      <div className="space-y-8">
        {/* GAME GRID */}
        <div>
          <SectionTitle title="Explore & Play" subtitle="Choose a letter game or a guided activity" icon={Gamepad2} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {GAMES.map((g, i) => (
              <motion.div
                key={g.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -6 }}
                className={`relative rounded-3xl p-6 bg-gradient-to-br ${g.grad} text-white shadow-md overflow-hidden`}
              >
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/15 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="text-5xl mb-3">{g.emoji}</div>
                  <h3 className="text-lg font-bold mb-2">{g.name}</h3>
                  <p className="text-sm text-white/90 leading-relaxed mb-4">{g.description}</p>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => openGame(g)}
                      aria-label={`Play ${g.name}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur font-semibold text-sm transition"
                    >
                      <Play className="w-4 h-4 fill-white" /> Play
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ALPHABET MATCH + CURRENT SESSION */}
        <div
          ref={alphabetGameRef}
          id="alphabet-match"
          data-testid="alphabet-match-game"
          tabIndex={-1}
          className="grid lg:grid-cols-3 gap-6 outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-3xl"
        >
          {/* LETTER MATCHING */}
          <Card className="lg:col-span-2 p-7">
            <div className="flex items-center justify-between mb-6">
              <SectionTitle title="Tap the Matching Letter" subtitle="Find the Tamil vowel that matches its written name" icon={Target} />
              <div className="flex items-center gap-3">
                <Badge color="gold"><Trophy className="w-3.5 h-3.5" /> {score}</Badge>
                <Badge color="coral"><Zap className="w-3.5 h-3.5" /> Streak {streak}</Badge>
              </div>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 p-8 text-center mb-6 border border-primary-100 dark:border-primary-800/40">
              <p className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-2">Find this letter</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={round.target.tamil}
                  initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                  className="tamil-letter text-7xl font-bold bg-gradient-to-br from-primary-500 to-secondary-500 bg-clip-text text-transparent"
                >
                  {round.target.english}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {round.options.map((opt) => (
                <motion.button
                  key={opt.tamil}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  animate={shakeId === opt.tamil ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  onClick={() => choose(opt)}
                  className="aspect-square rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 flex items-center justify-center hover:border-primary-400 hover:shadow-lg transition-all"
                >
                  <span className="tamil-letter text-4xl font-bold text-neutral-800 dark:text-white">{opt.tamil}</span>
                </motion.button>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <GradientButton onClick={() => { setRound(buildRound()); toast('🔄 New round!') }}>
                <Zap className="w-4 h-4" /> New Round
              </GradientButton>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle title="This play session" subtitle="Your matches during this visit" icon={Trophy} />
            <dl className="space-y-5 text-neutral-700 dark:text-neutral-200">
              <div><dt className="text-sm text-neutral-500">Points earned</dt><dd className="text-3xl font-semibold mt-1">{score}</dd></div>
              <div><dt className="text-sm text-neutral-500">Consecutive matches</dt><dd className="text-3xl font-semibold mt-1">{streak}</dd></div>
            </dl>
            <p className="text-sm leading-relaxed text-neutral-500 mt-6">Each correct match adds 10 points. These letter-game points last for this visit.</p>
            <button onClick={() => { setScore(0); setStreak(0); setRound(buildRound()) }} className="mt-5 text-sm font-semibold text-primary-600 dark:text-primary-400 underline underline-offset-4">Start a fresh letter session</button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
