import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Headphones, Mic, Pause, RotateCcw, Sparkles, Square, Star, Volume2, VolumeX } from 'lucide-react'
import { TAMIL_VOWELS } from '../training/tamilCurriculum'
import { RecordingLifecycle, microphoneMessage } from './recordingLifecycle'
import { vowelApi, requestId } from './vowelApi'
import { VOWEL_MODES, canRetryChallenge, challengeMatch, feedbackText, formatPercent, isScorable, isSuccessful, resultMood } from './vowelPresentation'
import { useAuthStore } from '../../store/authStore'
import PippinStorybook from '../../components/storybook/PippinStorybook'
import './vowels.css'
import '../../styles/lesson-coach-frame.css'
import { TAMIL_VOWEL_SYMBOLS, TAMIL_IDENTITY_ORDER, tamilVowel, tamilLength, tamilPair } from './tamilLabels'

const TARGETS = TAMIL_VOWELS.filter(item => !['ai', 'au'].includes(item.phoneme))
const STATUS = { IDLE: 'Ready when you are', GETTING_READY: 'Getting your microphone ready…', RECORDING: 'Listening. Say your vowel naturally.', PROCESSING: 'Recording complete. Finding your sound…', RESULT: 'Your result is ready', RETRY: 'Let’s try that sound again', ERROR: 'Let’s get you ready to try again', COMPLETED: 'Session complete' }

function AnimatedScore({ value }) {
  const [shown, setShown] = useState(() => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.round(value) : 0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(Math.round(value)); return }
    let frame
    const start = performance.now()
    const tick = now => {
      const fraction = Math.min(1, (now - start) / 650)
      setShown(Math.round(value * (1 - (1 - fraction) ** 3)))
      if (fraction < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <span aria-label={`${Math.round(value)} out of 100`}><span aria-hidden="true">{shown}</span><small aria-hidden="true"> / 100</small></span>
}

export function ResultCard({ result, mode, retry, next, busy, progress, debug = false }) {
  const resultHeading = useRef(null)
  useEffect(() => { resultHeading.current?.focus({ preventScroll: true }) }, [result])
  const analysis = result.vowel_analysis || {}
  const listening = mode === 'match-sound'
  const scored = isScorable(result) || (listening && result.kind === 'listening')
  const success = listening ? result.correct : isSuccessful(result)
  const perfect = isScorable(result) && (result.celebration === 'perfect' || result.accuracy === 100)
  return <div className={`vowel-result ${scored && success ? 'vowel-result-success' : ''} ${perfect ? 'vowel-result-perfect' : ''}`}>
    <p className="vowel-eyebrow">{scored ? listening ? 'YOUR LISTENING RESULT' : 'YOUR SOUND, DISCOVERED' : 'A LITTLE MORE PRACTICE'}</p>
    <h2 ref={resultHeading} tabIndex={-1}>{!scored ? 'Let’s hear it again.' : listening ? result.correct ? 'You found its match.' : 'A new sound to explore.' : perfect ? 'A perfect little moment!' : result.celebration === 'excellent' || result.accuracy >= 90 ? 'Beautifully done.' : success ? 'You found your sound.' : 'You’re getting closer.'}</h2>
    {scored && !listening && <div className="vowel-result-score"><AnimatedScore value={result.accuracy} />{success && <Sparkles className="vowel-success-spark" aria-hidden="true" />}</div>}
    {listening && scored && <p className="vowel-feedback">நீங்கள் தேர்ந்தெடுத்தது {tamilVowel(result.identity, result.length)} ({tamilLength(result.length)}). கேட்ட ஒலி {tamilVowel(result.target_identity, result.target_length)} ({tamilLength(result.target_length)}).</p>}
    {scored && <dl className="vowel-measurements"><div><dt>{listening ? 'Vowel' : 'Detected vowel'}</dt><dd>{tamilVowel(analysis.identity || result.identity, analysis.length || result.length)}</dd></div><div><dt>Length</dt><dd className={`vowel-length-${analysis.length}`}>{tamilLength(analysis.length || result.length)}</dd></div>{!listening && <><div><dt>Vowel duration</dt><dd>{Number.isFinite(analysis.duration_seconds) ? `${analysis.duration_seconds.toFixed(2)} s` : '—'}</dd></div><div><dt>Confidence</dt><dd>{formatPercent(analysis.confidence)}</dd></div></>}</dl>}
    {scored && !listening && <p className="vowel-duration-note">Voiced sound &gt; 1.00 s = long; 1.00 s or less = short. Recording silence is excluded.</p>}
    <p className="vowel-feedback">{feedbackText(result)}</p>
    {perfect && <p className="vowel-perfect-reward"><Star size={20} fill="currentColor" aria-hidden="true" /> Perfect sound badge · {result.xp_earned} XP earned</p>}
    {debug && result.debug_features && <details className="vowel-debug"><summary>Development measurements</summary><p>{result.model_version}</p><dl>{Object.entries(result.debug_features).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl><p>F0 is a periodicity-derived estimate. These measurements support debugging.</p></details>}
    {scored && !listening && <div className="vowel-components">{[['identity', 'Vowel identity', 40], ['duration', 'Short / long', 30], ['pronunciation', 'Acoustic match', 20], ['consistency', 'Consistency', 10]].map(([key, label, max]) => <div key={key}><span>{label}</span><meter aria-label={`${label} points out of ${max}`} min="0" max={max} value={result.score_components?.[key] || 0} /><b>{Number.isFinite(result.score_components?.[key]) ? Math.round(result.score_components[key]) : '—'}<small> / {max}</small></b></div>)}</div>}
    {progress?.current_streak > 0 && <p className="vowel-earned"><Sparkles size={16} /> {progress.current_streak} successful {progress.current_streak === 1 ? 'attempt' : 'attempts'} in a row · {progress.xp} XP earned</p>}
    {result.stars_earned > 0 && <div className="vowel-earned-stars" aria-label={`${result.stars_earned} stars earned`}>{Array.from({ length: Math.min(3, result.stars_earned) }, (_, star) => <Star size={20} key={star} fill="currentColor" aria-hidden="true" />)}<span>{result.xp_earned} XP for this sound</span></div>}
    {progress?.badges?.length > 0 && <p className="vowel-milestone-label">Milestone: {progress.badges.at(-1).label}</p>}
    <div className="vowel-actions">{(!scored || canRetryChallenge(mode)) && <button className={`vowel-button ${scored && result.accuracy >= 50 ? 'vowel-button-quiet' : ''}`} onClick={retry} disabled={busy}><RotateCcw size={17} /> Try again</button>}{scored && <button className="vowel-button" onClick={next} disabled={busy}>{busy ? 'Saving…' : mode === 'practice' ? 'Finish practice' : 'Continue'}<ArrowRight size={17} /></button>}</div>
  </div>
}

export function SessionSummary({ data, restart, onExit, mode }) {
  const summary = data.summary || data.session?.summary || data
  const score = summary.overall_score ?? summary.average_score
  const maxima = { identity: 40, duration: 30, pronunciation: 20, consistency: 10 }
  return <div className="vowel-summary"><p className="vowel-eyebrow">SESSION COMPLETE</p><h2>{Number.isFinite(score) && score > 50 ? 'Look how far you’ve come.' : 'Every sound is a step forward.'}</h2>{Number.isFinite(score) && <div className="vowel-result-score"><AnimatedScore value={score} /></div>}<p>{['speed-round', 'match-sound'].includes(mode) && Number.isFinite(summary.successful_challenges) ? `${summary.successful_challenges} of ${summary.challenge_count} challenges matched. ` : ''}Keep exploring. Confidence grows with practice.</p>
    {Number.isFinite(score) && summary.component_averages && <dl className="vowel-measurements">{Object.entries(summary.component_averages).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{Number.isFinite(value) ? `${Math.round(value / (maxima[key] || 100) * 100)}%` : '—'}</dd></div>)}</dl>}
    <div className="vowel-summary-insights">{[['strengths', 'Your strengths'], ['weaknesses', 'Room to grow'], ['recommendations', 'Try next']].map(([key, label]) => <div key={key}><h3>{label}</h3>{summary[key]?.length ? <ul>{summary[key].map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.message || `${item.length || ''} ${item.identity || item.target_phoneme || ''}`}</li>)}</ul> : <p>{key === 'recommendations' ? 'Try another sound or revisit your vowel map.' : 'More practice will reveal your patterns.'}</p>}</div>)}</div>
    <div className="vowel-actions"><button className="vowel-button" onClick={restart}><RotateCcw size={17} /> {mode === 'practice' ? 'Practise again' : 'Start a new session'}</button>{onExit && <button className="vowel-button vowel-button-quiet" onClick={onExit}>Explore more<ArrowRight size={17} /></button>}</div></div>
}

export default function VowelStudio({ mode = 'practice', initialTarget = 'a', onExit }) {
  const role = useAuthStore(state => state.user?.role)
  const debug = import.meta.env.DEV && role === 'admin' && new URLSearchParams(window.location.search).get('debug') === '1'
  const canonicalMode = mode === 'evaluation' ? 'evaluate' : mode
  const [target, setTarget] = useState(initialTarget)
  const [session, setSession] = useState(null)
  const [index, setIndex] = useState(0)
  const [capture, setCapture] = useState({ state: 'IDLE', remaining: 7, result: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [summary, setSummary] = useState(null)
  const [completed, setCompleted] = useState([])
  const [sound, setSound] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [heard, setHeard] = useState(false)
  const [choice, setChoice] = useState({ identity: '', length: '' })
  const [answerBusy, setAnswerBusy] = useState(false)
  const [paused, setPaused] = useState(false)
  const [retrySeed, setRetrySeed] = useState(0)
  const canvas = useRef(null)
  const orbit = useRef(null)
  const audioMeter = useRef(null)
  const recorder = useRef(null)
  const audio = useRef(null)
  const pending = useRef(null)
  const mounted = useRef(true)
  const answerLock = useRef(false)
  const challenge = session?.challenges?.[index]
  const local = TARGETS.find(item => item.phoneme === (challenge?.target_phoneme || target)) || TARGETS[0]
  const identity = challenge?.identity || local.phoneme[0].toUpperCase()
  const length = challenge?.length || (local.phoneme.length > 1 ? 'long' : 'short')
  const isListening = canonicalMode === 'match-sound'
  const active = ['GETTING_READY', 'RECORDING', 'PROCESSING'].includes(capture.state)
  const game = VOWEL_MODES.find(item => item.id === canonicalMode)
  const title = game?.title || (canonicalMode === 'evaluate' ? 'Find your progress.' : 'தமிழ் ஒலிகளைப்\nபழகுவோம்.')

  const stopAudio = useCallback(() => { if (audio.current) { audio.current.pause(); audio.current.src = ''; audio.current = null } setPlaying(false) }, [])
  const frame = useCallback((samples, level) => {
    orbit.current?.style.setProperty('--vowel-level', String(level))
    audioMeter.current?.setAttribute('aria-valuenow', String(Math.round(level * 100)))
    const surface = canvas.current
    const context = surface?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, surface.width, surface.height)
    context.lineWidth = 2
    context.strokeStyle = '#143c31'
    context.beginPath()
    if (samples) samples.forEach((sample, point) => {
      const x = point / (samples.length - 1) * surface.width
      const y = surface.height / 2 + (sample - 128) / 128 * surface.height * .45
      if (point === 0) context.moveTo(x, y); else context.lineTo(x, y)
    })
    else { context.moveTo(0, surface.height / 2); context.lineTo(surface.width, surface.height / 2) }
    context.stroke()
  }, [])

  useEffect(() => {
    mounted.current = true
    recorder.current = new RecordingLifecycle({ onChange: update => { if (mounted.current) setCapture(previous => ({ ...previous, ...update })) }, onFrame: frame, analyze: vowelApi.analyze })
    return () => { mounted.current = false; recorder.current?.cancel({ silent: true }); pending.current?.abort(); if (audio.current) { audio.current.pause(); audio.current.src = '' } }
  }, [frame])

  useEffect(() => {
    const controller = new AbortController()
    pending.current?.abort()
    pending.current = controller
    recorder.current?.cancel()
    stopAudio()
    setLoading(true); setError(null); setSession(null); setIndex(0); setSummary(null); setCompleted([]); setHeard(false); setPaused(false); setChoice({ identity: '', length: '' }); setAnswerBusy(false); answerLock.current = false
    // Let effect cleanup cancel a transient mount before sending a mutating
    // request (including React Strict Mode's setup/cleanup replay).
    const creation = window.setTimeout(() => {
      if (controller.signal.aborted) return
      vowelApi.createSession(canonicalMode, canonicalMode === 'practice' ? target : undefined, controller.signal).then(data => {
        if (!controller.signal.aborted) setSession(data.session || data)
      }).catch(problem => { if (!controller.signal.aborted) setError(microphoneMessage(problem)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 0)
    return () => { window.clearTimeout(creation); controller.abort() }
  }, [canonicalMode, target, retrySeed, stopAudio])

  useEffect(() => { if (capture.response?.progress) setProgress(capture.response.progress) }, [capture.response])
  useEffect(() => { setTarget(initialTarget) }, [initialTarget])

  const retry = () => { recorder.current.cancel(); setCapture({ state: 'IDLE', remaining: 7, result: null }); setError(null); setChoice({ identity: '', length: '' }) }
  const start = () => {
    if (!session || loading || paused) return
    stopAudio()
    recorder.current.start({ session_id: session.session_id || session.id, target_phoneme: challenge.target_phoneme, challenge_index: index, request_id: requestId(), debug })
  }
  const playReference = () => {
    if (!sound || !challenge) return
    stopAudio(); setError(null)
    const source = challenge.audio || local.audio
    if (!source) { setError('This reference sound is not available yet. Please try another practice sound.'); return }
    const reference = new Audio(source)
    audio.current = reference
    reference.onended = () => { if (audio.current === reference) { setPlaying(false); setHeard(true) } }
    reference.onerror = () => { if (audio.current === reference) { setPlaying(false); setError('The reference sound could not be loaded. Please try playing it again.') } }
    reference.play().then(() => { if (audio.current === reference) setPlaying(true) }).catch(() => { if (audio.current === reference) setError('Audio playback could not start. Press Listen again.') })
  }
  const answer = async () => {
    if (answerLock.current || !heard || !choice.identity || !choice.length) return
    answerLock.current = true; setAnswerBusy(true); setError(null)
    const controller = new AbortController(); pending.current = controller
    try {
      const response = await vowelApi.answer(session.session_id || session.id, { ...choice, challenge_index: index, request_id: requestId() }, controller.signal)
      if (!controller.signal.aborted) { setCapture({ state: response.result?.kind === 'listening' ? 'RESULT' : response.result?.scorable === false ? 'RETRY' : 'RESULT', result: response.result || response, response }); if (response.progress) setProgress(response.progress) }
    } catch (problem) { if (!controller.signal.aborted) setError(microphoneMessage(problem)) }
    finally { if (!controller.signal.aborted) { answerLock.current = false; setAnswerBusy(false) } }
  }
  const next = async () => {
    if (answerLock.current || !(isScorable(capture.result) || capture.result?.kind === 'listening')) return
    const accepted = [...completed.filter(item => item.index !== index), { index, result: capture.result }]
    setCompleted(accepted)
    if (index + 1 < session.challenges.length) {
      retry(); setIndex(index + 1); setHeard(false); stopAudio(); return
    }
    answerLock.current = true; setAnswerBusy(true); setError(null)
    const controller = new AbortController(); pending.current = controller
    try {
      const response = await vowelApi.complete(session.session_id || session.id, controller.signal)
      if (!controller.signal.aborted) { setSummary(response); setCapture(previous => ({ ...previous, state: 'COMPLETED' })) }
    } catch (problem) { if (!controller.signal.aborted) setError(microphoneMessage(problem)) }
    finally { if (!controller.signal.aborted) { answerLock.current = false; setAnswerBusy(false) } }
  }
  const pause = () => { if (!capture.result) recorder.current.cancel(); pending.current?.abort(); stopAudio(); setAnswerBusy(false); answerLock.current = false; setPaused(true) }
  const exit = () => { recorder.current.cancel(); pending.current?.abort(); stopAudio(); onExit?.() }
  const mood = resultMood(capture.state, capture.result)
  const pippinSucceeded = isListening ? capture.result?.kind === 'listening' && capture.result.correct === true : isScorable(capture.result) && isSuccessful(capture.result)
  const pippinMood = capture.state === 'RECORDING' ? 'listening' : ['GETTING_READY', 'PROCESSING'].includes(capture.state) ? 'processing' : capture.result ? (pippinSucceeded ? 'success' : 'retry') : isListening || canonicalMode === 'pippin-challenge' ? 'teaching' : 'idle'
  const pippinMessage = capture.state === 'RECORDING' ? 'I’m listening. Just one natural vowel.' : capture.state === 'PROCESSING' ? 'Let’s listen closely to your sound…' : capture.result ? feedbackText(capture.result) : isListening ? 'Listen all the way through. Can you find the sound?' : canonicalMode === 'pippin-challenge' ? `சொல்லுங்கள்: ${local.symbol} (${tamilLength(length)})! ${challenge?.tip || local.tip}` : 'There’s no rush. Every try is a step forward.'
  const displayed = capture.result ? [...completed.filter(item => item.index !== index), { index, result: capture.result }] : completed
  const catches = displayed.filter(item => challengeMatch(item.result))

  return <section className={`vowel-studio vowel-mode-${canonicalMode}`} data-state={capture.state}>
    <div className="vowel-toolbar"><div>{onExit && <button className="vowel-text-button" onClick={exit}><ArrowLeft size={17} /> Back</button>}</div><div className="vowel-toolbar-actions"><button className="vowel-icon-button" onClick={() => { setSound(!sound); if (sound) stopAudio() }} aria-label={sound ? 'Turn sound off' : 'Turn sound on'} aria-pressed={sound}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>{session && !summary && !paused && !active && <button className="vowel-text-button" onClick={pause} disabled={loading || answerBusy}><Pause size={15} /> Pause</button>}</div></div>
    {summary ? <SessionSummary data={summary} mode={canonicalMode} restart={() => setRetrySeed(seed => seed + 1)} onExit={onExit} /> : <>
      <div className="vowel-studio-grid"><div className="vowel-introduction vowel-choice-coach-frame"><p className="vowel-eyebrow">{canonicalMode === 'practice' ? 'THE VOWEL STUDIO' : canonicalMode === 'evaluate' ? 'YOUR TEN-SOUND CHECK-IN' : 'PLAY & DISCOVER'}</p><h1 lang={canonicalMode === 'practice' ? 'ta' : 'en'}>{title.split('\n').map((line, i) => <span key={line}>{i ? <em>{line}</em> : line}{i === 0 && title.includes('\n') && <br />}</span>)}</h1><p className="vowel-lead">{game?.instruction || (canonicalMode === 'evaluate' ? 'Ten vowels, one gentle check-in. Discover what comes naturally and what to practise next.' : 'கேளுங்கள். சொல்லுங்கள். மீண்டும் முயலுங்கள். Practise one Tamil sound with Pippin.')}</p>
        {canonicalMode === 'practice' && <div className="vowel-target-selector"><label htmlFor="vowel-target">Choose your sound</label><select id="vowel-target" value={target} onChange={event => setTarget(event.target.value)} disabled={active || answerBusy || loading}>{TARGETS.map(item => <option key={item.phoneme} value={item.phoneme}>{item.symbol} · {item.phoneme.length > 1 ? 'நெடில் / Long' : 'குறில் / Short'}</option>)}</select></div>}
        {session && canonicalMode !== 'practice' && <div className="vowel-session-track"><span>Sound {index + 1} of {session.challenges.length}</span><progress max={session.challenges.length} value={completed.length} aria-label="Completed challenges" /></div>}
        <div className={`vowel-pippin vowel-pippin-${mood}`}><PippinStorybook compact transparent mood={pippinMood} message={pippinMessage} /><div><b>A little help from Pippin</b><p>{pippinMessage}</p></div></div>
        <p className="vowel-privacy">Your recording is analysed, then discarded. Your learning progress is saved.</p>
      </div>
      <div className="vowel-stage">
        {loading ? <div className="vowel-loading" role="status">Preparing your sounds…</div> : paused ? <div className="vowel-pause"><Pause size={35} /><h2>Take a little breath.</h2><p>Your session is paused. An interrupted recording is discarded.</p><button className="vowel-button" onClick={() => setPaused(false)}>Resume session<ArrowRight size={17} /></button></div> : capture.result ? <ResultCard result={capture.result} mode={canonicalMode} retry={retry} next={next} busy={answerBusy} progress={progress} debug={debug} /> : session ? <>
          <div className="vowel-target"><span className="vowel-eyebrow">{isListening ? 'LISTEN & DISCOVER' : 'YOUR SOUND'}</span><div>{isListening ? <Headphones size={42} /> : <><strong lang="ta">{challenge?.symbol || local.symbol}</strong><span className={`vowel-length-tag vowel-length-${length}`}>{tamilLength(length)}</span><small className="vowel-transliteration">/{local.phoneme}/</small></>}</div></div>
          {isListening ? <div className="vowel-listening-game"><button className="vowel-listen-orb" onClick={playing ? stopAudio : playReference} disabled={!sound} aria-label={playing ? 'Stop reference sound' : 'Play reference sound'}>{playing ? <Square size={30} /> : <Headphones size={38} />}<span>{playing ? 'Playing…' : 'Listen'}</span></button><fieldset disabled={!heard || answerBusy}><legend>Which vowel did you hear?</legend><div className="vowel-choice-row">{TAMIL_IDENTITY_ORDER.map(vowel => <button key={vowel} className="vowel-choice" aria-label={tamilPair(vowel)} aria-pressed={choice.identity === vowel} onClick={() => setChoice(old => ({ ...old, identity: vowel }))}><span lang="ta">{tamilPair(vowel)}</span></button>)}</div><legend className="vowel-length-question">And how long was it?</legend><div className="vowel-choice-row">{['short', 'long'].map(value => <button key={value} className="vowel-choice vowel-choice-length" aria-label={`${tamilLength(value)} / ${value}`} aria-pressed={choice.length === value} onClick={() => setChoice(old => ({ ...old, length: value }))}>{tamilLength(value)}<small>{value}</small></button>)}</div></fieldset><button className="vowel-button" disabled={!heard || !choice.identity || !choice.length || answerBusy} onClick={answer}>{answerBusy ? 'Checking…' : 'Check my answer'}<Check size={17} /></button>{!sound && <p>Turn sound on to listen to the reference.</p>}</div> : <>
          <div className="vowel-orbit" ref={orbit}><div className="vowel-orbit-ring vowel-orbit-ring-one" /><div className="vowel-orbit-ring vowel-orbit-ring-two" /><div className="vowel-orbit-ring vowel-orbit-ring-three" /><div className="vowel-orbit-core"><Mic size={45} strokeWidth={1.35} /><span className="vowel-timer" aria-hidden="true">{capture.state === 'PROCESSING' ? '0.0' : capture.remaining.toFixed(1)}<small>s</small></span><span className="vowel-core-label">{capture.state === 'RECORDING' ? 'LISTENING' : capture.state === 'PROCESSING' ? 'ANALYSING' : 'SECONDS TO EXPLORE'}</span><div className="vowel-audio-meter" ref={audioMeter} role="meter" aria-label="Live microphone level" aria-description="Input volume on a logarithmic display scale" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i /></div></div></div>
          <p className="vowel-say-once"><strong lang="ta">{length === 'short' ? 'குறில்: சுருக்கமாக ஒரு முறை சொல்லுங்கள்.' : 'நெடில்: ஒலியை நீட்டி ஒரு முறை சொல்லுங்கள்.'}</strong><span>{length === 'short' ? 'Keep the voiced sound at or below 1.00 second.' : 'Hold the voiced sound beyond 1.00 second.'} Then stay quiet; silence does not count.</span></p><canvas className="vowel-waveform" ref={canvas} width="340" height="55" role="img" aria-label={capture.state === 'RECORDING' ? 'Live microphone waveform' : 'Microphone waveform appears while recording'} />
          <div className="vowel-record-actions">{active ? <div className="vowel-auto-status" role="status"><span className="vowel-auto-pulse" aria-hidden="true" />{capture.state === 'PROCESSING' ? 'Evaluating your vowel…' : capture.state === 'GETTING_READY' ? 'Preparing microphone…' : 'Listening — finishes automatically'}</div> : <button className="vowel-button vowel-start" onClick={start}><Mic size={18} /> Start recording<ArrowRight size={18} /></button>}<p>{capture.state === 'RECORDING' ? 'Say one vowel naturally. We stop automatically.' : capture.state === 'GETTING_READY' ? 'Allow microphone access to begin.' : capture.state === 'PROCESSING' ? 'Measuring the vowel, its length, and confidence.' : 'Seven seconds. One sound. Your own pace.'}</p></div>
          {!active && <button className="vowel-text-button vowel-reference" onClick={playing ? stopAudio : playReference} disabled={!sound}><Volume2 size={17} />{playing ? 'Stop example' : 'Listen to an example'}</button>}
          </>}
        </> : null}
        {(error || capture.error) && <div className="vowel-notice" role="alert"><p>{error || capture.error}</p>{!session && <button className="vowel-button" onClick={() => setRetrySeed(seed => seed + 1)}>Try again</button>}</div>}
      </div>
      </div>
      {canonicalMode === 'practice' && <div className="vowel-pair-rail" aria-label="Choose a vowel">{['a', 'i', 'u', 'e', 'o'].map(letter => <div key={letter} className="vowel-pair">{[letter, letter + letter].map(phoneme => <button key={phoneme} aria-pressed={target === phoneme} disabled={active || loading || answerBusy} onClick={() => setTarget(phoneme)}><b lang="ta">{TAMIL_VOWEL_SYMBOLS[phoneme]}</b><span>{phoneme.length === 1 ? 'குறில்' : 'நெடில்'}</span><i /></button>)}</div>)}</div>}
      {canonicalMode === 'vowel-catch' && <div className="vowel-catch-tray"><span>YOUR COLLECTION · {catches.length} caught</span><div>{catches.length ? catches.map(item => <span className="vowel-caught" key={item.index}>{tamilVowel(item.result.vowel_analysis?.identity, item.result.vowel_analysis?.length)}<small>{tamilLength(item.result.vowel_analysis?.length)}</small></span>) : <p>Each matching sound will land here.</p>}</div></div>}
      {canonicalMode === 'vowel-tower' && <div className={`vowel-tower ${capture.result && !challengeMatch(capture.result) ? 'vowel-tower-shake' : ''}`}><span>{catches.length} levels built</span><div>{catches.length ? catches.map(item => <div className="vowel-tower-level" key={item.index}>{item.result.vowel_analysis?.identity} · {item.result.vowel_analysis?.length}</div>) : <p>Your first sound is the foundation.</p>}</div></div>}
      {canonicalMode === 'short-or-long' && <div className="vowel-length-guide"><div className={length === 'short' ? 'vowel-guide-active' : ''}><span lang="ta">குறில் / Short</span><i /><p>Voiced sound ≤ 1.00 second.</p></div><div className={length === 'long' ? 'vowel-guide-active' : ''}><span lang="ta">நெடில் / Long</span><i /><p>Voiced sound &gt; 1.00 second.</p></div></div>}
    </>}
    <a className="vowel-credits-link" href="/tamil">உயிரெழுத்துகள் · சொற்கள் · வாக்கியங்கள்</a><a className="vowel-credits-link" href="/credits">About the voice examples</a>
    <p className="vowel-sr-only" role="status" aria-live="polite">{paused ? 'Session paused' : STATUS[capture.state]}</p>
  </section>
}
