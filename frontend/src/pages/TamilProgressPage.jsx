import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Gamepad2, RotateCcw, Sparkles } from 'lucide-react'
import VowelShell from '../components/layout/VowelShell'
import { useTamilCatalog, useTamilProgress } from '../features/tamil/useTamilLearning'
import { TAMIL_KINDS } from '../features/tamil/tamilLearning'
import './TamilProgressPage.css'

const GAME_NAMES = {
  'letter-match': 'Letter Match', 'find-letter': 'Find the Letter',
  'picture-word-match': 'Picture → Word Match', 'listen-choose': 'Listen & Choose',
  'word-builder': 'Word Builder',
}

export default function TamilProgressPage() {
  const saved = useTamilProgress()
  const catalog = useTamilCatalog()
  const progress = saved.progress
  const due = (progress?.review_due_items || []).map(id => catalog.items.find(item => item.id === id)).filter(Boolean)
  const next = due[0] || catalog.items.find(item => !progress?.completed_items?.includes(item.id))
  const completed = progress?.completed_total || 0
  const total = progress?.lesson_total || 0
  return <VowelShell className="tamil-progress-world"><main className="tamil-progress-page">
    <header className="tamil-progress-hero"><div><p>உங்கள் வளர்ச்சி · YOUR JOURNEY</p><h1>Every little try counts.</h1><span>Lessons, games, and practice in one honest learning record.</span></div><Sparkles size={62} strokeWidth={1.2} aria-hidden="true" /></header>
    {saved.loading ? <p role="status">Loading saved Tamil progress…</p> : saved.error ? <div role="alert" className="tamil-progress-alert"><p>Your saved progress could not be loaded. {saved.error}</p><button onClick={saved.refresh}><RotateCcw size={16} /> Retry</button></div> : <>
      <section className="tamil-progress-summary" aria-label="Learning summary"><div><strong>{completed}<small> / {total}</small></strong><span>Lessons completed</span></div><div><strong>{progress?.total_attempts || 0}</strong><span>Practice attempts</span></div><div><strong>{progress?.game_total_attempts || 0}</strong><span>Saved game rounds</span></div><div><strong>{progress?.scored_attempts ? `${Math.round(progress.average_score)}%` : '—'}</strong><span>Measured speech average</span></div></section>
      <section className="tamil-progress-section"><div className="tamil-progress-heading"><BookOpen size={23} /><h2>Learning the language</h2></div><div className="tamil-progress-kinds">{TAMIL_KINDS.map(kind => { const row = progress?.by_kind?.[kind.id]; const value = row?.completed || 0; const max = row?.total || kind.total; return <Link key={kind.id} to={`/training?kind=${kind.id}`}><span lang="ta">{kind.label}</span><strong>{value} / {max}</strong><progress max={max} value={value} aria-label={`${kind.english} completed`} /><small>{kind.english} · {row?.attempts || 0} attempts</small></Link> })}</div></section>
      <section className="tamil-progress-section"><div className="tamil-progress-heading"><Gamepad2 size={23} /><h2>Five games, one journey</h2></div><div className="tamil-progress-games">{Object.entries(GAME_NAMES).map(([id, title]) => { const row = progress?.by_game?.[id]; return <div key={id}><strong>{title}</strong><span>{row?.attempts || 0} rounds</span><b>{row?.attempts ? `${row.accuracy}% correct` : 'Not played yet'}</b></div> })}</div><Link className="tamil-progress-link" to="/games">Play a Tamil game <ArrowRight size={17} /></Link></section>
      <section className="tamil-progress-section tamil-progress-next"><div><div className="tamil-progress-heading"><Sparkles size={23} /><h2>Your next small step</h2></div>{next ? <p>{due.length ? 'A lesson is ready for review.' : 'Continue with the next lesson in Tamil order.'} <strong lang="ta">{next.text}</strong></p> : <p>All available lessons have been visited. Try a game or revisit a favourite.</p>}</div><Link to={next ? `/tamil/practice/${encodeURIComponent(next.id)}` : '/games'}>{next ? 'Open lesson' : 'Play a game'} <ArrowRight size={17} /></Link></section>
      <section className="tamil-progress-section"><h2>Recent Tamil practice</h2>{progress?.recent_attempts?.length ? <ul className="tamil-progress-recent">{progress.recent_attempts.slice(0, 8).map((attempt, index) => <li key={attempt.id || index}><span lang="ta">{attempt.text}</span><small>{attempt.mode === 'recognition' ? 'Recognition' : 'Speaking'} · {attempt.correct ? 'Correct' : attempt.scorable === false && attempt.mode === 'audio' ? 'Not scored' : 'Review'}</small></li>)}</ul> : <p>No Tamil attempts yet. Your first lesson is ready.</p>}<Link className="tamil-progress-link" to="/progress/vowels">View detailed Vowel Studio history <ArrowRight size={17} /></Link></section>
    </>}
  </main></VowelShell>
}
