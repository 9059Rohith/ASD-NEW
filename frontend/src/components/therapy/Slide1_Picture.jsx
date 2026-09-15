import { motion, useReducedMotion } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { speakTamilLesson } from '../../utils/speechRepeat'

export default function Slide1_Picture({ lesson, onNext }) {
  const reducedMotion = useReducedMotion()
  const playAudio = () => {
    void speakTamilLesson(lesson.symbol, { lineId: lesson.voice_key })
  }
  const pictureMotion = {
    amma: { y: [0, -8, 0], rotate: [-.5, .5, -.5] },
    appa: { y: [0, -6, 0], rotate: [-1, 1, -1] },
    maram: { rotate: [-1.2, 1.2, -1.2], scale: [1, 1.015, 1] },
    pazham: { y: [0, -10, 0], scale: [1, 1.025, 1] },
  }[lesson.phoneme]

  if (lesson.type === 'word' && lesson.image) {
    return (
      <div data-testid="dedicated-word-picture-slide" className="min-h-[calc(100vh-92px)] flex items-center justify-center p-4 md:p-8">
        <motion.section initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <div className="relative h-[min(66vh,720px)] min-h-[420px] overflow-hidden bg-sky-100">
            <motion.img
              src={lesson.image}
              alt={`${lesson.english} meaning`}
              data-picture-motion={lesson.phoneme}
              className="w-full h-full object-cover"
              animate={reducedMotion ? undefined : pictureMotion}
              transition={{ duration: lesson.phoneme === 'maram' ? 4.5 : 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-900/25 to-transparent pt-24 pb-7 px-6 text-center text-white">
              <h2 className="tamil-letter text-5xl md:text-7xl font-black drop-shadow-lg">{lesson.symbol}</h2>
              <p className="mt-2 text-xl md:text-3xl font-extrabold tracking-wide">{lesson.english}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-5 md:p-6">
            <button onClick={playAudio} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-secondary hover:bg-secondary-dark text-white font-bold rounded-full transition"><Volume2 className="w-6 h-6" /> Listen in Tamil</button>
            <button onClick={onNext} className="w-full sm:w-auto px-10 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-full shadow-lg">Next slide →</button>
          </div>
        </motion.section>
      </div>
    )
  }
  
  return (
    <div data-testid="letter-picture-layout" className="h-full flex items-center justify-center p-8">
      <div className="max-w-6xl w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid lg:grid-cols-2 gap-8 bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Left panel - Tamil letter/word */}
          <div className="bg-gradient-to-br from-primary to-primary-dark p-12 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Sparkle animations */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-white rounded-full"
                initial={{
                  x: Math.random() * 400,
                  y: Math.random() * 400,
                  scale: 0
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3
                }}
              />
            ))}
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="relative z-10"
            >
              <div className="text-9xl tamil-letter font-bold text-white mb-4 text-center">
                {lesson.symbol}
              </div>
              
              <div className="text-5xl font-bold text-white/90 text-center mb-6">
                {lesson.english}
              </div>
              
              <div className="flex justify-center space-x-1">
                {[...Array(lesson.difficulty)].map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                    className="text-3xl"
                  >
                    ⭐
                  </motion.span>
                ))}
              </div>
            </motion.div>
          </div>
          
          {/* Right panel - Image */}
          <div className="p-12 flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full"
            >
              <div
                data-testid="lesson-built-in-visual"
                role="img"
                aria-label={`${lesson.english} pronunciation symbol`}
                className="relative w-full aspect-square bg-gradient-to-br from-secondary/20 to-accent/20 rounded-3xl flex flex-col items-center justify-center mb-6 overflow-hidden"
              >
                <div className="tamil-letter text-9xl font-bold text-primary mb-4">{lesson.symbol}</div>
                <div className="text-3xl font-bold text-gray-700">{lesson.english}</div>
              </div>
              
              <p className="text-center text-gray-600 mb-6 italic">
                Look at the symbol, then listen and repeat the sound.
              </p>
              
              <button
                onClick={playAudio}
                className="w-full bg-secondary hover:bg-secondary-dark text-white font-bold py-4 rounded-2xl transition flex items-center justify-center space-x-2 mb-4"
              >
                <Volume2 className="w-6 h-6" />
                <span>Listen</span>
              </button>
              
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-center text-gray-500 text-sm"
              >
                👆 Tap to hear it again!
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
        
        {/* Next button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-8"
        >
          <button
            onClick={onNext}
            className="px-12 py-4 bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark text-white font-bold rounded-full transition shadow-lg"
          >
            Next →
          </button>
        </motion.div>
      </div>
    </div>
  )
}
