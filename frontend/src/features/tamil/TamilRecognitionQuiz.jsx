import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { createTamilRequestId } from './tamilLearning'
import { tamilQuizOptions, tamilQuizPrompt } from './tamilQuiz'
import { tamilApi } from './tamilApi'

export default function TamilRecognitionQuiz({ item, catalog, onNext }) {
  const options = useMemo(() => tamilQuizOptions(item, catalog), [item, catalog])
  const [state, setState] = useState({ selected: null, pending: false, result: null, error: null })
  const [mode, setMode] = useState(item.kind === 'aytham' ? 'writing' : 'visual')
  const [audioError, setAudioError] = useState(false)
  const [consonantId, setConsonantId] = useState('')
  const [vowelId, setVowelId] = useState('')
  const [wordOrder, setWordOrder] = useState([])
  const [writtenText, setWrittenText] = useState('')
  const controller = useRef(null)
  const pendingAnswer = useRef(null)
  const feedback = useRef(null)
  const listening = mode === 'listening' && Boolean(item.audio_url)
  const meaning = mode === 'meaning'
  const composing = mode === 'composition'
  const ordering = mode === 'ordering'
  const writing = mode === 'writing'
  const words = useMemo(() => item.kind === 'sentence' ? item.text.trim().split(/\s+/u) : [], [item])
  const consonants = useMemo(() => catalog.filter(candidate => candidate.kind === 'consonant'), [catalog])
  const vowels = useMemo(() => catalog.filter(candidate => candidate.kind === 'vowel'), [catalog])
  const reset = (preserveRequest = false) => {
    if (!preserveRequest) pendingAnswer.current = null
    setState({ selected: null, pending: false, result: null, error: null })
  }
  useEffect(() => {
    pendingAnswer.current = null
    setState({ selected: null, pending: false, result: null, error: null })
    setMode(item.kind === 'aytham' ? 'writing' : 'visual')
    setAudioError(false)
    setConsonantId('')
    setVowelId('')
    setWordOrder([])
    setWrittenText('')
    return () => controller.current?.abort()
  }, [item.id])
  useEffect(() => { if (state.result || state.error) feedback.current?.focus({ preventScroll: true }) }, [state.result, state.error])
  const choose = async (selectedId = null, selectedIds = null, enteredText = null) => {
    if (state.pending || state.result) return
    const promptType = listening ? 'audio_recognition' : meaning ? 'meaning_matching' : composing ? 'uyirmei_composition' : ordering ? 'sentence_ordering' : writing ? 'text_writing' : ['word', 'sentence'].includes(item.kind) ? 'text_recognition' : 'character_recognition'
    const selectionKey = JSON.stringify([selectedId, selectedIds, enteredText])
    if (!pendingAnswer.current || pendingAnswer.current.selectionKey !== selectionKey || pendingAnswer.current.promptType !== promptType) {
      pendingAnswer.current = { selectionKey, promptType, requestId: createTamilRequestId() }
    }
    const request = new AbortController()
    controller.current = request
    setState({ selected: selectedId, pending: true, result: null, error: null })
    try {
      const answer = await tamilApi.answer({
        item_id: item.id,
        ...(selectedId ? { selected_id: selectedId } : enteredText !== null ? { written_text: enteredText } : { selected_ids: selectedIds }),
        prompt_type: promptType,
        request_id: pendingAnswer.current.requestId,
      }, request.signal)
      if (!request.signal.aborted) {
        pendingAnswer.current = null
        setState({ selected: selectedId, pending: false, result: answer.result, error: null })
      }
    } catch (error) {
      if (!request.signal.aborted) setState({ selected: selectedId, pending: false, result: null,
        error: error.response?.data?.detail || 'Your answer could not be saved. Check your connection and try again.' })
    }
  }
  if (options.length < 2 && item.kind !== 'aytham') return <p className="tamil-notice">Recognition choices are unavailable for this lesson.</p>
  return <section className={`tamil-quiz tamil-quiz-${item.kind}`} aria-labelledby="tamil-quiz-title">
    <p className="tamil-overline">அடையாளம் காண்க · RECOGNIZE</p>
    <div className="tamil-quiz-modes" role="group" aria-label="Challenge type">
      {item.kind !== 'aytham' && <button type="button" aria-pressed={mode === 'visual'} disabled={state.pending} onClick={() => { setMode('visual'); reset(false) }}>Read and choose</button>}
      {item.audio_url && <button type="button" aria-pressed={listening} disabled={state.pending} onClick={() => { setMode('listening'); setAudioError(false); reset(false) }}>Listen and choose</button>}
      {['word', 'sentence'].includes(item.kind) && <button type="button" aria-pressed={meaning} disabled={state.pending} onClick={() => { setMode('meaning'); reset(false) }}>Match meaning</button>}
      {item.kind === 'uyirmei' && <button type="button" aria-pressed={composing} disabled={state.pending} onClick={() => { setMode('composition'); reset(false) }}>Build letter</button>}
      {item.kind === 'sentence' && words.length > 1 && <button type="button" aria-pressed={ordering} disabled={state.pending} onClick={() => { setMode('ordering'); reset(false) }}>Arrange words</button>}
      <button type="button" aria-pressed={writing} disabled={state.pending} onClick={() => { setMode('writing'); reset(false) }}>Type Tamil</button>
    </div>
    <h2 id="tamil-quiz-title">{listening ? 'Listen to the Tamil example. Which text matches?' : meaning ? 'What does this Tamil text mean?' : composing ? 'Choose the consonant and vowel that build this letter.' : ordering ? `Arrange the Tamil words to say: ${item.meaning}` : writing ? item.kind === 'aytham' ? 'Write the Tamil aytham symbol.' : ['word', 'sentence'].includes(item.kind) ? `Write the Tamil for: ${item.meaning}` : `Write the Tamil character for the “${item.transliteration}” sound.` : tamilQuizPrompt(item)}</h2>
    {listening && <audio className="tamil-quiz-audio" controls preload="none" src={item.audio_url} aria-label="Tamil listening example" onError={() => { setAudioError(true); setMode('visual') }}>Your browser cannot play this audio.</audio>}
    {audioError && <p className="tamil-notice" role="alert">This listening example could not play. Try the reading challenge instead.</p>}
    {meaning && <p className="tamil-quiz-target" lang="ta">{item.text}</p>}
    {composing && <p className="tamil-quiz-target" lang="ta">{item.text}</p>}
    <p className="tamil-muted">{ordering ? 'Tap each word in the right order.' : composing ? 'Select one consonant and one vowel.' : writing ? 'Type using a Tamil keyboard or paste Tamil text.' : 'Choose one answer.'} Your result is saved with your learning progress.</p>
    {!composing && !ordering && !writing && <div className={`tamil-quiz-choices ${meaning ? 'tamil-quiz-meaning-choices' : ''}`}>{options.map(option => <button key={option.id} type="button"
      className={`tamil-quiz-choice ${state.selected === option.id ? 'is-selected' : ''}`}
      onClick={() => choose(option.id)} disabled={state.pending || Boolean(state.result)}
      aria-pressed={state.selected === option.id} lang={meaning ? undefined : 'ta'}>{meaning ? option.meaning : option.text}</button>)}</div>}
    {composing && <div className="tamil-quiz-build">
      <label>Consonant <select value={consonantId} onChange={event => setConsonantId(event.target.value)} disabled={state.pending || Boolean(state.result)}><option value="">Choose a consonant</option>{consonants.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.text}</option>)}</select></label>
      <span aria-hidden="true">+</span>
      <label>Vowel <select value={vowelId} onChange={event => setVowelId(event.target.value)} disabled={state.pending || Boolean(state.result)}><option value="">Choose a vowel</option>{vowels.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.text}</option>)}</select></label>
      <button className="tamil-button" type="button" disabled={!consonantId || !vowelId || state.pending || Boolean(state.result)} onClick={() => choose(null, [consonantId, vowelId])}>Check letter</button>
    </div>}
    {ordering && <div className="tamil-quiz-order">
      <p>Tap a selected word to remove it:</p><div className="tamil-quiz-word-row" aria-label="Your sentence">{wordOrder.length ? wordOrder.map((index, position) => <button key={index} type="button" lang="ta" disabled={state.pending || Boolean(state.result)} onClick={() => setWordOrder(previous => previous.filter((_, choice) => choice !== position))}>{words[index]}</button>) : <span>No words selected yet</span>}</div>
      <p>Available words:</p><div className="tamil-quiz-word-row" aria-label="Available words">{words.map((word, index) => ({ word, index })).reverse().filter(({ index }) => !wordOrder.includes(index)).map(({ word, index }) => <button key={index} type="button" lang="ta" disabled={state.pending || Boolean(state.result)} onClick={() => setWordOrder(previous => [...previous, index])}>{word}</button>)}</div>
      <button className="tamil-button" type="button" disabled={wordOrder.length !== words.length || state.pending || Boolean(state.result)} onClick={() => choose(null, wordOrder.map(String))}>Check order</button>
    </div>}
    {writing && <div className="tamil-quiz-writing"><label htmlFor="tamil-written-answer">Your Tamil answer</label>{item.kind === 'sentence'
      ? <textarea id="tamil-written-answer" lang="ta" value={writtenText} onChange={event => setWrittenText(event.target.value)} maxLength={200} rows={3} spellCheck={false} disabled={state.pending || Boolean(state.result)} />
      : <input id="tamil-written-answer" lang="ta" value={writtenText} onChange={event => setWrittenText(event.target.value)} maxLength={200} spellCheck={false} autoComplete="off" disabled={state.pending || Boolean(state.result)} />}
      <button className="tamil-button" type="button" disabled={!writtenText.trim() || state.pending || Boolean(state.result)} onClick={() => choose(null, null, writtenText)}>Check writing</button>
    </div>}
    {state.pending && <p role="status">Checking and saving your answer…</p>}
    {state.error && <div className="tamil-notice" role="alert" ref={feedback} tabIndex={-1}><p>{state.error}</p><button type="button" className="tamil-text-button" onClick={() => reset(true)}>Try again</button></div>}
    {state.result && <div className={`tamil-quiz-feedback ${state.result.correct ? 'is-correct' : 'is-retry'}`} role="status" aria-live="polite" ref={feedback} tabIndex={-1}>
      <strong>{state.result.correct ? 'சரி! · Correct' : 'மீண்டும் பழகலாம் · Keep practising'}</strong>
      {!state.result.correct && <span>Correct answer: <b lang={meaning ? undefined : 'ta'}>{meaning ? item.meaning : item.text}</b></span>}
      <div className="tamil-actions"><button type="button" className="tamil-button tamil-button-quiet" onClick={() => reset(false)}><RotateCcw size={17} /> Retry</button>{onNext && <button type="button" className="tamil-button" onClick={onNext}>Next lesson <ArrowRight size={17} /></button>}</div>
    </div>}
  </section>
}
