import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { compareTamilText } from './tamilText'
import { createTamilRecognizer } from './tamilRecognizer'

export default function TamilTranscriptPractice({ item }) {
  const recognizer = useRef(null)
  const [available, setAvailable] = useState(false)
  const [state, setState] = useState({ status: 'idle', transcript: '', error: null })
  useEffect(() => {
    recognizer.current = createTamilRecognizer(window)
    setAvailable(recognizer.current.available)
    setState({ status: 'idle', transcript: '', error: null })
    return () => recognizer.current?.stop()
  }, [item.id])
  const start = () => {
    setState({ status: 'starting', transcript: '', error: null })
    recognizer.current?.start({
      onState: status => setState(previous => ({ ...previous, status })),
      onResult: transcript => setState({ status: 'result', transcript, error: null }),
      onError: error => setState({ status: 'error', transcript: '', error }),
    })
  }
  const stop = () => { recognizer.current?.stop(); setState({ status: 'idle', transcript: '', error: null }) }
  const comparison = state.transcript ? compareTamilText(item.text, state.transcript) : null
  const active = ['starting', 'listening'].includes(state.status)
  return <section className="tamil-transcript-practice" aria-labelledby="tamil-transcript-title">
    <p className="tamil-overline">குரலை எழுத்தாக்குதல் · TAMIL SPEECH TO TEXT</p>
    <h2 id="tamil-transcript-title">Speak and see what the browser recognized</h2>
    <p className="tamil-muted">The browser’s Tamil recognizer may use an online speech service. Short isolated letters are harder to transcribe than words.</p>
    {available ? <button type="button" className="tamil-button tamil-button-quiet" onClick={active ? stop : start}>{active ? <Square size={17} /> : <Mic size={17} />}{active ? 'Stop listening' : 'Recognize my Tamil speech'}</button> : <p className="tamil-notice" role="status">Tamil speech recognition is unavailable in this browser. You can still use the listening and recognition exercises.</p>}
    {active && <p role="status">{state.status === 'starting' ? 'Requesting microphone access…' : 'Listening for Tamil speech…'}</p>}
    {state.error && <p className="tamil-notice" role="alert">{state.error}</p>}
    {comparison && <div className="tamil-transcript-result" role="status" aria-live="polite"><span>Recognized Tamil</span><p lang="ta">{state.transcript}</p><strong>{comparison.correct ? 'Exact Tamil text match' : comparison.score >= 90 ? 'Close text; check each word' : 'Text did not match yet'} · {comparison.score}/100</strong><small>This compares recognized text, not clinical pronunciation quality.</small><button type="button" className="tamil-text-button" onClick={start}>Try again</button></div>}
  </section>
}
