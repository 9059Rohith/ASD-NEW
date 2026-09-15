import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Headphones, Pause, Play, RotateCcw, Sparkles } from 'lucide-react'
import VowelShell from '../components/layout/VowelShell'
import { useTamilCatalog, useTamilProgress } from '../features/tamil/useTamilLearning'
import { createTamilRequestId, itemsForTamilKind } from '../features/tamil/tamilLearning'
import { tamilApi } from '../features/tamil/tamilApi'
import './TamilGamesPage.css'

const GAMES = [
  { id: 'letter-match', title: 'Letter Match', tamil: 'எழுத்துப் பொருத்தம்', hint: 'See a letter. Find its identical twin.', tone: 'mint', mark: 'அ' },
  { id: 'find-letter', title: 'Find the Letter', tamil: 'எழுத்தைக் கண்டுபிடி', hint: 'Look closely among similar Tamil letters.', tone: 'peach', mark: 'ழ' },
  { id: 'picture-word-match', title: 'Picture → Word Match', tamil: 'படமும் சொல்லும்', hint: 'Look at a picture and choose its word.', tone: 'sky', mark: 'மரம்' },
  { id: 'listen-choose', title: 'Listen & Choose', tamil: 'கேட்டுத் தேர்ந்தெடு', hint: 'Hear a real Tamil vowel recording.', tone: 'lilac', mark: 'ஈ' },
  { id: 'word-builder', title: 'Word Builder', tamil: 'சொல் அமைப்பு', hint: 'Put Tamil sound pieces in order.', tone: 'yellow', mark: 'அம்மா' },
]
const PICTURES = { 'word-amma': '/assets/words/amma.png', 'word-appa': '/assets/words/appa.png', 'word-maram': '/assets/words/maram.png', 'word-naai': '/assets/words/naai.svg', 'word-yaanai': '/assets/words/yaanai.svg' }
const PIECES = {
  'word-amma': ['அ', 'ம்', 'மா'], 'word-appa': ['அ', 'ப்', 'பா'],
  'word-maram': ['ம', 'ர', 'ம்'], 'word-naai': ['நா', 'ய்'],
}
const ROUND_COUNT = 5

function gamePool(gameId, items) {
  if (gameId === 'letter-match') return itemsForTamilKind(items, 'vowel')
  if (gameId === 'find-letter') return itemsForTamilKind(items, 'consonant')
  if (gameId === 'picture-word-match') return items.filter(item => PICTURES[item.id])
  if (gameId === 'listen-choose') return items.filter(item => item.kind === 'vowel' && item.audio_available_human && item.audio_url)
  return items.filter(item => PIECES[item.id])
}

function choicesFor(target, pool, roundIndex) {
  const alternatives = pool.filter(item => item.id !== target.id)
  const start = (roundIndex * 3) % alternatives.length
  const choices = [target, ...Array.from({ length: Math.min(3, alternatives.length) }, (_, index) => alternatives[(start + index) % alternatives.length])]
  return choices.sort((a, b) => (a.id.charCodeAt(a.id.length - 1) + roundIndex) % 7 - (b.id.charCodeAt(b.id.length - 1) + roundIndex) % 7)
}

function wordTiles(item) {
  const pieces = PIECES[item.id] || []
  return pieces.map((text, index) => ({ text, id: `${item.id}-${index}` })).reverse()
}

export default function TamilGamesPage() {
  const catalog = useTamilCatalog()
  const saved = useTamilProgress()
  const [gameId, setGameId] = useState(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [answer, setAnswer] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [placed, setPlaced] = useState([])
  const [audioError, setAudioError] = useState(null)
  const [paused, setPaused] = useState(false)
  const audioRef = useRef(null)
  const requestRef = useRef(null)
  const choiceRef = useRef(null)
  const game = GAMES.find(entry => entry.id === gameId)
  const pool = useMemo(() => gamePool(gameId, catalog.items), [gameId, catalog.items])
  const target = pool.length ? pool[roundIndex % pool.length] : null
  const choices = useMemo(() => target ? choicesFor(target, pool, roundIndex) : [], [target, pool, roundIndex])
  const tiles = target ? wordTiles(target) : []
  const selectedTiles = placed.map(id => tiles.find(tile => tile.id === id)).filter(Boolean)
  const attempted = roundIndex + (answer ? 1 : 0)
  const accuracy = attempted ? Math.round((score / 10) / attempted * 100) : 0

  useEffect(() => () => { audioRef.current?.pause() }, [])
  const open = id => { audioRef.current?.pause(); setGameId(id); setRoundIndex(0); setScore(0); setStreak(0); setAnswer(null); setError(null); setPlaced([]); setAudioError(null); setPaused(false); requestRef.current = null; choiceRef.current = null }
  const next = () => { setRoundIndex(index => index + 1); setAnswer(null); setError(null); setPlaced([]); setAudioError(null); requestRef.current = null; choiceRef.current = null }
  const play = () => {
    if (!target?.audio_available_human || !target.audio_url) return
    audioRef.current?.pause()
    const clip = new Audio(target.audio_url)
    audioRef.current = clip
    clip.play().then(() => setAudioError(null)).catch(() => setAudioError('The human Tamil recording could not be played.'))
  }
  const submit = async (selectedId, writtenText) => {
    if (pending || answer || !target) return
    if (!requestRef.current) requestRef.current = createTamilRequestId()
    choiceRef.current = { selectedId, writtenText }
    setPending(true); setError(null)
    try {
      const response = await tamilApi.gameAnswer({ game_slug: gameId, item_id: target.id, selected_id: selectedId || null, written_text: writtenText || null, request_id: requestRef.current })
      setAnswer(response.attempt)
      if (response.attempt.correct) { setScore(value => value + 10); setStreak(value => value + 1) }
      else setStreak(0)
      saved.refresh()
    } catch (cause) {
      setError(cause.response?.data?.detail || 'Your answer could not be saved. Try again.')
    } finally { setPending(false) }
  }

  return <VowelShell className="tamil-game-world"><main className="tamil-game-page">
    <header className="tamil-game-header"><p>தமிழ் விளையாட்டுகள் · TAMIL PLAYROOM</p><h1>Play your way into Tamil.</h1><span>Five little adventures. Every try helps you grow.</span></header>
    {!game ? <><div className="tamil-game-list">{GAMES.map((entry, index) => <button key={entry.id} type="button" className={`tamil-game-tile tone-${entry.tone}`} onClick={() => open(entry.id)}><span className="tamil-game-number">0{index + 1}</span><span className="tamil-game-mark" lang="ta">{entry.mark}</span><span lang="ta" className="tamil-game-tamil">{entry.tamil}</span><strong>{entry.title}</strong><small>{entry.hint}</small><span className="tamil-game-launch">Play <ArrowRight size={18} /></span><span className="tamil-game-stat">{saved.progress?.by_game?.[entry.id]?.attempts ?? 0} saved rounds</span></button>)}</div><div className="tamil-game-extra"><Link to="/games/vowels">Explore Vowel Studio games <ArrowRight size={16} /></Link><Link to="/training">Back to Tamil lessons <ArrowRight size={16} /></Link></div></>
      : <section className="tamil-game-session" aria-label={`${game.title} game`}><div className="tamil-game-toolbar"><button type="button" disabled={pending} onClick={() => { audioRef.current?.pause(); setGameId(null) }}><ArrowLeft size={18} /> All games</button><span>{roundIndex < ROUND_COUNT ? `Round ${roundIndex + 1} of ${ROUND_COUNT}` : 'Complete'}</span><strong>{score} points · {streak} streak · {attempted} tries · {accuracy}% correct</strong>{roundIndex < ROUND_COUNT && <button type="button" disabled={pending} onClick={() => { audioRef.current?.pause(); setPaused(value => !value) }}>{paused ? <><Play size={17} /> Resume</> : <><Pause size={17} /> Pause</>}</button>}<button type="button" disabled={pending} onClick={() => open(gameId)}><RotateCcw size={17} /> Restart</button></div>
      {catalog.loading ? <p role="status">Loading Tamil lessons…</p> : catalog.error ? <p role="alert">{catalog.error}</p> : !pool.length ? <p role="status">No approved items are available for this game yet.</p> : roundIndex >= ROUND_COUNT ? <div className="tamil-game-finish"><Sparkles size={48} /><h2>Beautiful effort!</h2><p>You earned {score} points across {ROUND_COUNT} saved rounds. Your learning record is ready.</p><button onClick={() => open(gameId)}><RotateCcw size={18} /> Play again</button><Link to="/progress">See your progress <ArrowRight size={18} /></Link></div> : paused ? <div className="tamil-game-finish" role="status"><Pause size={42} /><h2>Take your time.</h2><p>Your current round is paused. Resume whenever you are ready.</p><button type="button" onClick={() => setPaused(false)}><Play size={18} /> Resume game</button></div> : <>
        <div className="tamil-game-prompt"><p lang="ta">{game.tamil}</p><h2>{game.title}</h2>{gameId === 'listen-choose' ? <><button className="tamil-game-listen" onClick={play} type="button"><Headphones size={24} /> Play the Tamil voice</button>{audioError && <span role="alert">{audioError}</span>}</> : gameId === 'picture-word-match' || gameId === 'word-builder' ? <><img className="tamil-game-picture" src={PICTURES[target.id]} alt={target.meaning} /><p>{target.meaning}</p></> : <div className="tamil-game-target" lang="ta">{target.text}</div>}<p>{game.hint}</p></div>
        {gameId === 'word-builder' ? <div className="tamil-game-builder"><div className="tamil-game-placed" aria-label="Built word">{selectedTiles.length ? selectedTiles.map(tile => <button type="button" disabled={Boolean(answer) || pending} key={tile.id} lang="ta" onClick={() => setPlaced(value => value.filter(id => id !== tile.id))}>{tile.text}</button>) : <span>Choose the pieces below</span>}</div><div className="tamil-game-choices">{tiles.filter(tile => !placed.includes(tile.id)).map(tile => <button key={tile.id} type="button" disabled={Boolean(answer) || pending} lang="ta" onClick={() => setPlaced(value => [...value, tile.id])}>{tile.text}</button>)}</div><button className="tamil-game-submit" type="button" disabled={Boolean(answer) || pending || selectedTiles.length !== tiles.length} onClick={() => submit(null, selectedTiles.map(tile => tile.text).join(''))}>Check word</button></div>
          : <div className="tamil-game-choices">{choices.map(option => <button key={option.id} type="button" lang="ta" disabled={Boolean(answer) || pending || Boolean(audioError && gameId === 'listen-choose')} onClick={() => submit(option.id)}>{option.text}</button>)}</div>}
        {pending && <p role="status">Saving your answer…</p>}{error && <div role="alert" className="tamil-game-error">{error}<button onClick={() => submit(choiceRef.current?.selectedId, choiceRef.current?.writtenText)}>Retry save</button></div>}
        {answer && <div className={`tamil-game-feedback ${answer.correct ? 'is-correct' : 'is-retry'}`} role="status"><strong>{answer.correct ? 'அருமை! · Wonderful!' : 'நல்ல முயற்சி · Good try!'}</strong><span>{answer.correct ? '+10 points saved' : <>The answer is <b lang="ta">{target.text}</b>. Keep exploring.</>}</span><button onClick={next}>{roundIndex + 1 === ROUND_COUNT ? 'Finish game' : 'Next round'} <ArrowRight size={18} /></button></div>}
      </>}</section>}
  </main></VowelShell>
}
