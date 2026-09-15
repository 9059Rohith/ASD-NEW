import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, AudioWaveform, Layers3, Headphones, Sparkles, Timer, Target, Mic2, BookOpen, ChevronDown } from 'lucide-react'
import VowelShell from '../components/layout/VowelShell'
import { VowelStudio, VowelProgress } from '../features/vowels'

export const VOWEL_PAIRS = [
  { identity: 'A', short: 'a', long: 'aa', symbols: ['அ', 'ஆ'], tip: 'வாயைத் திறந்து சொல்லுங்கள்.' },
  { identity: 'I', short: 'i', long: 'ii', symbols: ['இ', 'ஈ'], tip: 'இதழ்களைச் சற்றே விரித்துச் சொல்லுங்கள்.' },
  { identity: 'U', short: 'u', long: 'uu', symbols: ['உ', 'ஊ'], tip: 'இதழ்களைக் குவித்துச் சொல்லுங்கள்.' },
  { identity: 'E', short: 'e', long: 'ee', symbols: ['எ', 'ஏ'], tip: 'தாடையைத் தளர்த்திச் சொல்லுங்கள்.' },
  { identity: 'O', short: 'o', long: 'oo', symbols: ['ஒ', 'ஓ'], tip: 'இதழ்களை வட்டமாக்கிச் சொல்லுங்கள்.' },
]
export const VOWEL_GAMES = [
  { id: 'vowel-catch', title: 'Vowel Catch', text: 'Say the sound and catch a little success.', icon: Target, type: 'Speak & collect', color: 'lime' },
  { id: 'short-or-long', title: 'Short or Long', text: 'A quick pulse or a longer note. Find the difference.', icon: AudioWaveform, type: 'Explore length', color: 'peach' },
  { id: 'match-sound', title: 'Match the Sound', text: 'Listen closely. Choose the vowel and its length.', icon: Headphones, type: 'Listen & discover', color: 'sky' },
  { id: 'pippin-challenge', title: 'Pippin Challenge', text: 'Follow your little guide through ten friendly prompts.', icon: Sparkles, type: 'Practice together', color: 'peach' },
  { id: 'speed-round', title: 'Speed Round', text: 'Ten sounds, one smooth journey. Take your time.', icon: Timer, type: 'Ten-sound session', color: 'sky' },
  { id: 'vowel-tower', title: 'Vowel Tower', text: 'Build your tower one clear sound at a time.', icon: Layers3, type: 'Speak & build', color: 'lime' },
]

export function VowelPairRail({ compact = false }) {
  return <div className={`voice-vowel-grid ${compact ? 'is-compact' : ''}`}>{VOWEL_PAIRS.map(pair => <article key={pair.identity}><span className="voice-vowel-letter" lang="ta">{pair.symbols[0]}<small>{pair.symbols[1]}</small></span><span className="voice-vowel-tamil">/{pair.short}/ · /{pair.long}/</span><div className="voice-length-links"><Link to={`/practice?target=${pair.short}`} aria-label={`Practice short ${pair.identity}`}><AudioWaveform size={21} /><span lang="ta">குறில்</span><small>Short</small></Link><Link to={`/practice?target=${pair.long}`} aria-label={`Practice long ${pair.identity}`}><span className="voice-long-mark" aria-hidden="true" /><span lang="ta">நெடில்</span><small>Long</small></Link></div><p>{pair.tip}</p></article>)}</div>
}

export function PracticePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const requested = params.get('target') || 'a'
  const target = VOWEL_PAIRS.some(pair => pair.short === requested || pair.long === requested) ? requested : 'a'
  return <VowelShell footer={false} className="voice-practice-page"><VowelStudio key={target} initialTarget={target} onExit={() => navigate('/training')} /></VowelShell>
}

export function TrainingOverview() {
  return <VowelShell><section className="voice-section"><div className="voice-section-heading"><h1 lang="ta">தமிழ் உயிரெழுத்துகள்</h1><p>A quick sound or a longer note. Listen to the difference, then make it your own.</p></div><VowelPairRail /><div className="voice-guide-band"><img src="/assets/vowel-studio/pippin-guide.png" alt="Pippin, your smiling orange kitten guide" /><div><h2>Your voice has a friend.</h2><p>Pippin listens, celebrates, and helps you try again.</p></div><Link className="voice-button voice-button-lime" to="/practice">Start practicing <ArrowRight size={20} /></Link></div><details className="voice-more-lessons"><summary><BookOpen size={20} /> Explore the full Tamil curriculum <ChevronDown size={18} /></summary><p>The original guided lessons include pictures, mouth-position support, diphthongs, and everyday words.</p><div>{[['அ',1],['ஆ',2],['இ',3],['ஈ',4],['உ',5],['ஊ',6],['எ',7],['ஏ',8],['ஐ',9],['ஒ',10],['ஓ',11],['ஔ',12],['அம்மா',13],['அப்பா',14],['மரம்',15],['பழம்',16]].map(([symbol,id]) => <Link key={id} to={`/therapy/${id}`} lang="ta">{symbol}<ArrowUpRight size={16} /></Link>)}</div></details></section></VowelShell>
}

export function VowelGamesPage() {
  return <VowelShell><section className="voice-section voice-games-hub"><div className="voice-section-heading"><h1>A little play.<br /><em>A lot to discover.</em></h1><p>Six ways to explore your voice. Choose an adventure and let Pippin come along.</p></div><div className="voice-game-grid">{VOWEL_GAMES.map((game,i) => <Link className={`voice-game-card voice-tone-${game.color}`} key={game.id} to={`/games/vowels/${game.id}`}><div className="voice-game-art" aria-hidden="true"><span className="voice-game-orbit" />{game.id === 'pippin-challenge' ? <img src="/assets/vowel-studio/pippin-guide.png" alt="" /> : <game.icon strokeWidth={1.15} />}</div><div className="voice-game-copy"><span className="voice-game-type">0{i+1} · {game.type}</span><h2>{game.title}</h2><p>{game.text}</p><span className="voice-game-start">Let’s play <ArrowUpRight size={21} /></span></div></Link>)}</div><div className="voice-page-links"><Link to="/play">Explore the original playroom <ArrowUpRight size={18} /></Link><Link to="/games/alphabet">Play Alphabet Match <ArrowUpRight size={18} /></Link></div></section></VowelShell>
}

export function VowelGamePage() {
  const { mode } = useParams()
  const navigate = useNavigate()
  if (!VOWEL_GAMES.some(game => game.id === mode)) return <VowelShell><div className="voice-section"><h1>Choose your next adventure.</h1><Link className="voice-button" to="/games">Explore games <ArrowRight /></Link></div></VowelShell>
  return <VowelShell footer={false}><VowelStudio key={mode} mode={mode} onExit={() => navigate('/games')} /></VowelShell>
}

export function VowelEvaluationPage() {
  const [started, setStarted] = useState(false)
  return <VowelShell footer={!started}>{started ? <VowelStudio mode="evaluate" onExit={() => setStarted(false)} /> : <section className="voice-section voice-evaluation-intro"><div><h1>Let your progress<br /><em>speak for itself.</em></h1><p>அ–ஆ, இ–ஈ, உ–ஊ, எ–ஏ, ஒ–ஓ: a check-in for these ten paired Tamil vowel sounds. ஐ and ஔ have separate practice in Learn Tamil.</p><ol className="voice-eval-steps"><li><span>01</span><div><strong>Listen to your prompt</strong><p>Hear each vowel before you try.</p></div></li><li><span>02</span><div><strong>Record one sound</strong><p>Your microphone records for seven seconds. Say the vowel once, then relax.</p></div></li><li><span>03</span><div><strong>Discover your next step</strong><p>See measured scores, strengths, and sounds to revisit. Unclear recordings can be retried.</p></div></li></ol><button className="voice-button" type="button" onClick={() => setStarted(true)}>Start evaluation <ArrowUpRight size={21} /></button><p className="voice-small-note">A learning check-in. Your pace, with breaks whenever you need.</p></div><div className="voice-eval-art"><span className="voice-orbit" /><img src="/assets/vowel-studio/pippin-guide.png" alt="Pippin waves, ready to explore sounds with you" /><blockquote>Every sound is a step forward.</blockquote></div></section>}<div className="voice-page-links voice-contained"><Link to="/progress">View previous sessions <ArrowUpRight size={17} /></Link><Link to="/assessment/letters">Explore letter quizzes <ArrowUpRight size={17} /></Link></div></VowelShell>
}

export function VowelProgressPage() {
  const navigate = useNavigate()
  return <VowelShell><div className="voice-section voice-progress-page"><VowelProgress onPractice={target => navigate(`/practice?target=${target}`)} /><div className="voice-page-links"><Link to="/evaluate">Take a new evaluation <ArrowUpRight size={18} /></Link><Link to="/progress/lessons">Full curriculum progress <ArrowUpRight size={18} /></Link><Link to="/reports">Care team reports <ArrowUpRight size={18} /></Link></div></div></VowelShell>
}

export function VowelCreditsPage() {
  return <VowelShell><article className="voice-section voice-credits"><h1>The voices<br /><em>behind the practice.</em></h1><h2>Human vowel examples</h2><p>Revathi Arunachalam, Vijayakrishnan VK, Nandhakumar N and Akilan A (2025). <a href="https://data.mendeley.com/datasets/2dnxmvm22k/1">Tamil vowels-speech database, version 1</a>. Mendeley Data. <a href="https://doi.org/10.17632/2dnxmvm22k/1">DOI: 10.17632/2dnxmvm22k/1</a>.</p><p>The voice examples and derived acoustic model use this dataset under <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International</a>. Individual vowels were segmented from continuous recordings, converted to mono 16 kHz audio where needed, and encoded as PCM WAV. Example clips come from the training speakers. The dataset authors have not endorsed this application.</p><h2>Tamil words and sentences</h2><p>All ten word examples use Microsoft’s online Tamil speech service with the native Tamil voice <code>ta-IN-ValluvarNeural</code>.</p><p>The eight sentence examples use Meta AI’s <a href="https://huggingface.co/facebook/mms-tts-tam">MMS Tamil text-to-speech model</a>, by Vineel Pratap and colleagues, revision e9cf59dae34f0f51e3b1842876a658e4516f9fe4. These sentence examples are supplied for noncommercial educational use under <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a>. Synthetic pronunciation is a learning aid, not an authoritative dialect reference.</p><p>All twelve vowels use human examples from the Tamil vowels-speech database above, with verified training-speaker provenance. <a href="/assets/tamil-reference/ATTRIBUTION.md">Read the complete audio attribution</a> or <a href="/assets/tamil-reference/manifest.json">inspect the source and file manifest</a>. The reference examples are separate from user microphone recordings and are not an independent recognition benchmark.</p><h2>Tamil language references</h2><p>The alphabet and குறில் / நெடில் classification follow <a href="https://www.tamilvu.org/courses/teacher_training/tt02/tt0201/tt0102012.htm">Tamil Virtual Academy</a>. Exact Tamil characters follow the <a href="https://www.unicode.org/charts/nameslist/n_0B80.html">Unicode Tamil character list</a>. New beginner words and sentences are authored for this application.</p><h2>Art and interaction</h2><p>Pippin is the application’s orange kitten guide. The new garden and Pippin artwork were generated for this project using OpenAI image generation. Typography, navigation, waveforms, controls, scores, and game interactions are implemented as accessible web components.</p><h2>Understanding your results</h2><p>Vowel Studio measures a voiced segment and predicts its vowel identity and short or long length separately. Results are learning feedback, not a clinical assessment. Uncertain, noisy, repeated, or clipped recordings can be declined. Different speakers and microphones can produce different results.</p><p>Your browser sends the recording to this application’s server for analysis. The studio saves measured results and progress; it does not retain your raw recording.</p><Link className="voice-button" to="/practice">Return to practice <ArrowRight size={19} /></Link></article></VowelShell>
}
