import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Download, RefreshCw, Star } from 'lucide-react'
import { vowelApi } from './vowelApi'
import { microphoneMessage } from './recordingLifecycle'
import './vowels.css'
import { TAMIL_VOWEL_SYMBOLS, tamilLength } from './tamilLabels'

export function useVowelProgress() {
  const [state, setState] = useState({ progress: null, history: [], loading: true, error: null })
  const active = useRef(null)
  const refresh = useCallback(async () => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setState(previous => ({ ...previous, loading: true, error: null }))
    try {
      const [progress, sessions] = await Promise.all([vowelApi.progress(controller.signal), vowelApi.history(controller.signal)])
      if (!controller.signal.aborted) setState({ progress: progress.progress || progress, history: Array.isArray(sessions) ? sessions : sessions.sessions || [], loading: false, error: null })
    } catch (error) {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: microphoneMessage(error) }))
    }
  }, [])
  useEffect(() => { refresh(); return () => active.current?.abort() }, [refresh])
  return { ...state, refresh }
}

export function exportVowelProgress(progress, history) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ exported_at: new Date().toISOString(), progress, sessions: history }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'my-vowel-progress.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function VowelProgress({ onPractice }) {
  const { progress, history, loading, error, refresh } = useVowelProgress()
  if (loading && !progress) return <div className="vowel-loading" role="status">Gathering your learning journey…</div>
  if (error) return <div className="vowel-notice" role="alert"><p>{error}</p><button className="vowel-button" onClick={refresh}><RefreshCw size={17} /> Try again</button></div>
  if (!progress) return null
  const hasScores = progress.scored_attempts > 0
  const recentScores = [...(progress.recent_scores || [])].filter(item => Number.isFinite(item.accuracy)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const visibleHistory = history.filter(item => item.summary?.challenge_count > 0)
  const evaluations = history.filter(item => item.status === 'completed' && ['evaluate', 'evaluation'].includes(item.mode) && Number.isFinite(item.summary?.average_score)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const improvement = evaluations.length >= 2 ? evaluations.at(-1).summary.average_score - evaluations.at(-2).summary.average_score : null
  return <section className="vowel-progress">
    <div className="vowel-progress-heading"><div><p className="vowel-eyebrow">YOUR LEARNING JOURNEY</p><h2>Small sounds.<br /><em>Growing confidence.</em></h2></div><button className="vowel-button vowel-button-quiet" onClick={() => exportVowelProgress(progress, history)}><Download size={17} /> Export progress</button></div>
    <div className="vowel-stat-row">
      <div><strong>{progress.scored_attempts ?? 0}</strong><span>Measured attempts</span></div>
      <div><strong>{hasScores && Number.isFinite(progress.average_score) ? Math.round(progress.average_score) : '—'}</strong><span>Average score / 100</span></div>
      <div><strong>{progress.current_streak ?? 0}</strong><span>Successful attempts in a row</span></div>
      <div><strong>{progress.xp ?? 0}</strong><span>Experience earned</span></div>
    </div>
    {!hasScores && <p className="vowel-empty">Your story starts with one sound. Complete a practice recording to see measured progress here.</p>}
    {recentScores.length > 1 && <div className="vowel-score-history"><div><h3>Your recent practice</h3><p>Every point is a saved, measured attempt. Best score: {Math.round(progress.best_score)} / 100.</p></div><svg viewBox="0 0 700 140" role="img" aria-label={`Recent scores in chronological order: ${recentScores.map(item => Math.round(item.accuracy)).join(', ')}`}><line x1="30" y1="15" x2="680" y2="15" /><line x1="30" y1="115" x2="680" y2="115" /><text x="0" y="20">100</text><text x="12" y="119">0</text><polyline points={recentScores.map((item, index) => `${30 + index / (recentScores.length - 1) * 650},${115 - item.accuracy}`).join(' ')} />{recentScores.map((item, index) => <circle key={index} cx={30 + index / (recentScores.length - 1) * 650} cy={115 - item.accuracy} r="3"><title>{TAMIL_VOWEL_SYMBOLS[item.target_phoneme]}: {Math.round(item.accuracy)} / 100</title></circle>)}</svg></div>}
    <div className="vowel-progress-columns"><div><h3>Your vowel map</h3><p>Identity and length are tracked separately for each sound.</p><div className="vowel-mastery-list">{(progress.per_vowel || []).map(item => <div className="vowel-mastery-row" key={item.target_phoneme}><span><b lang="ta">{TAMIL_VOWEL_SYMBOLS[item.target_phoneme]}</b> <small>{tamilLength(item.length)}</small></span><meter min="0" max="100" value={item.average_score || 0} aria-label={`${item.length} ${item.identity} average score`} /><span>{item.attempts && Number.isFinite(item.average_score) ? `${Math.round(item.average_score)}%` : 'New'}</span>{onPractice && <button className="vowel-icon-button" aria-label={`Practice ${item.length} ${item.identity}`} onClick={() => onPractice(item.target_phoneme)}><ArrowRight size={18} /></button>}</div>)}</div></div>
      <aside className="vowel-milestones"><Star size={26} /><h3>{progress.level || 'Beginner'}</h3><p>{progress.mastered_classes ?? 0} of {progress.total_classes ?? 10} vowel classes mastered</p>{(progress.badges || []).length ? <ul>{progress.badges.map(badge => <li key={badge.id}>{badge.label}</li>)}</ul> : <p>Your milestones will appear as you practise.</p>}<p>Best streak: <b>{progress.longest_streak ?? 0}</b></p></aside></div>
    <div className="vowel-history"><h3>Session history</h3>{evaluations.length > 0 && <p>{evaluations.length} completed {evaluations.length === 1 ? 'evaluation' : 'evaluations'} in your recent history. {improvement !== null && `Latest change: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} points compared with your previous evaluation.`}</p>}{visibleHistory.length === 0 ? <p>Sessions with measured attempts will appear here.</p> : <div className="vowel-table-wrap"><table><thead><tr><th>Session</th><th>Date</th><th>Score</th><th>Status</th></tr></thead><tbody>{visibleHistory.map((session, index) => <tr key={session.id || session.session_id || index}><td>{(session.mode || 'Practice').replaceAll('-', ' ')}</td><td>{session.created_at ? new Date(session.created_at).toLocaleDateString() : '—'}</td><td>{Number.isFinite(session.summary?.overall_score ?? session.summary?.average_score) ? `${Math.round(session.summary.overall_score ?? session.summary.average_score)} / 100` : session.mode === 'match-sound' && session.summary ? `${session.summary.successful_challenges} / ${session.summary.challenge_count} matches` : '—'}</td><td>{session.status}</td></tr>)}</tbody></table></div>}</div>
  </section>
}
