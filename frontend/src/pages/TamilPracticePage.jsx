import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Headphones, Mic, RotateCcw } from 'lucide-react'
import VowelShell from '../components/layout/VowelShell'
import TamilPracticeResult from '../features/tamil/TamilPracticeResult'
import TamilTranscriptPractice from '../features/tamil/TamilTranscriptPractice'
import PippinStorybook from '../components/storybook/PippinStorybook'
import TamilLessonVisual from '../features/tamil/TamilLessonVisual'
import { TAMIL_KINDS, itemsForTamilKind, tamilLengthLabel, tamilPracticeHref } from '../features/tamil/tamilLearning'
import { useTamilCatalog, useTamilExample, useTamilRecording } from '../features/tamil/useTamilLearning'
import '../features/tamil/tamilLearning.css'
import '../styles/lesson-coach-frame.css'

const STATUS = { IDLE: 'தயாரானதும் தொடங்கலாம். Ready when you are.', GETTING_READY: 'ஒலிவாங்கியைத் தயாராக்குகிறோம். Preparing your microphone.', RECORDING: 'கேட்கிறோம். Listening. Say the example once naturally.', PROCESSING: 'ஒலிகளை ஒப்பிடுகிறோம். Comparing the recorded sounds.', RESULT: 'உங்கள் முயற்சியின் முடிவு தயார். Your result is ready.', RETRY: 'மீண்டும் முயற்சி செய்யலாம். Please try this example again.', ERROR: 'மீண்டும் தொடங்க உதவுகிறோம். Please check the microphone message.' }

function useTeacherIntroduction(item, example) {
  useEffect(() => {
    if (!item.audio_available_human || document.hidden) return
    const key = `tamil-human-intro-${item.id}`
    if (sessionStorage.getItem(key)) return
    const timer = setTimeout(() => {
      sessionStorage.setItem(key, '1')
      example.play()
    }, 650)
    return () => clearTimeout(timer)
  }, [item.id, item.audio_available_human, example.play])
}

function TamilPippinCoach({ mood = 'idle', tamil, english }) {
  return <aside className={'tamil-pippin tamil-pippin-' + mood} aria-label="Pippin's encouragement">
    <PippinStorybook compact transparent mood={mood} message={tamil + ' ' + english} />
    <div className="tamil-pippin-copy">
      <span className="tamil-pippin-label">Pippin is learning with you</span>
      <p lang="ta">{tamil}</p>
      <small>{english}</small>
    </div>
  </aside>
}

function TamilPippinCard({ mood = 'idle', tamil, english }) {
  return <section className="tamil-pippin-card" aria-labelledby="tamil-pippin-title">
    <p className="tamil-overline" id="tamil-pippin-title"><span lang="ta">பிப்பின்</span> · PIPPIN</p>
    <TamilPippinCoach mood={mood} tamil={tamil} english={english} />
  </section>
}

function TamilStudy({ item, items }) {
  const example = useTamilExample(item.text, item.audio_url || null)
  useTeacherIntroduction(item, example)
  const parentConsonant = items.find(candidate => candidate.id === item.consonant_id)
  const parentVowel = items.find(candidate => candidate.id === item.vowel_id)
  const peers = itemsForTamilKind(items, item.kind)
  const index = peers.findIndex(peer => peer.id === item.id)
  return <VowelShell footer={false} className="tamil-world"><div className="tamil-practice-page tamil-study-page" data-kind={item.kind}>
    <div className="tamil-practice-toolbar"><Link className="tamil-text-button" to={`/tamil?kind=${item.kind}`}><ArrowLeft size={17} /> Back to {item.kind === 'consonant' ? 'consonants' : item.kind === 'aytham' ? 'aytham' : 'combined letters'}</Link><span>{index + 1} / {peers.length}</span></div>
    <div className="tamil-practice-grid"><section className="tamil-example" aria-labelledby="tamil-study-title"><p className="tamil-overline">{item.kind === 'consonant' ? 'மெய்யெழுத்து · CONSONANT' : item.kind === 'aytham' ? 'ஆய்த எழுத்து · AYTHAM' : 'உயிர்மெய் · COMBINED LETTER'}</p><TamilLessonVisual item={item} large /><h1 id="tamil-study-title" lang="ta">{item.text}</h1><p className="tamil-example-meaning">{item.transliteration}</p>{parentConsonant && parentVowel && <p className="tamil-letter-equation" lang="ta" aria-label={`${parentConsonant.text} plus ${parentVowel.text} makes ${item.text}`}><span>{parentConsonant.text}</span><b>+</b><span>{parentVowel.text}</span><b>=</b><strong>{item.text}</strong></p>}<p lang="ta" className="tamil-instruction">{item.tip_ta}</p><p className="tamil-muted">{item.tip}</p>
      {item.kind !== 'aytham' && <div className="tamil-example-audio"><button type="button" className="tamil-button tamil-button-quiet" onClick={example.speaking ? example.stop : example.play} disabled={!example.available}><Headphones size={18} /> {example.speaking ? 'Stop' : item.audio_kind === 'human_tamil' ? 'Listen to human teacher' : 'Listen to Tamil example'}</button>{!example.available && <p className="tamil-voice-unavailable" role="status">A Tamil audio example is still needed for this letter. You can practise recognition below.</p>}{example.error && <p className="tamil-notice" role="alert">{example.error}</p>}</div>}
      <p className="tamil-study-note">{item.kind === 'aytham' ? 'Aytham is learned as a written symbol. Its sound changes with context, so this lesson checks writing rather than an isolated pronunciation.' : 'Say the letter aloud after listening. Recognition below checks the character you choose; it is separate from microphone pronunciation scoring.'}</p>
    </section><div className="tamil-study-actions"><p className="tamil-overline"><span lang="ta">பயிற்சி</span> · PRACTICE</p><section className="tamil-quiz-launch"><p className="tamil-overline">அடையாளம் காண்க · RECOGNIZE</p><h2>Ready to check what you learned?</h2><p>The question opens without the lesson answer in view.</p><Link className="tamil-button" to={`/tamil/quiz/${encodeURIComponent(item.id)}`}>Start recognition challenge <ArrowRight size={17} /></Link></section>{item.kind !== 'aytham' && <TamilTranscriptPractice item={item} />}</div><TamilPippinCard tamil="ஒன்றாகப் பழகலாம்!" english="Pippin is here to practise this letter with you." /></div>
    <div className="tamil-bottom-links"><Link to={`/tamil?kind=${item.kind}`}>Explore more <ArrowRight size={16} /></Link><Link to={item.kind === 'aytham' ? '/tamil?kind=uyirmei' : '/tamil?kind=word'}>{item.kind === 'aytham' ? 'Learn combined letters' : 'Learn words'}</Link></div>
  </div></VowelShell>
}

function TamilPractice({ item, items }) {
  const navigate = useNavigate()
  const recording = useTamilRecording(item)
  const example = useTamilExample(item.text, item.audio_url || null)
  useTeacherIntroduction(item, example)
  const active = ['GETTING_READY', 'RECORDING', 'PROCESSING'].includes(recording.state)
  const kind = TAMIL_KINDS.find(category => category.id === item.kind)
  const peers = itemsForTamilKind(items, item.kind)
  const position = peers.findIndex(peer => peer.id === item.id)
  const next = peers[position + 1]
  const readyToRecord = () => { example.stop(); recording.start() }
  const leave = () => { example.stop(); recording.cancel(); navigate(`/tamil?kind=${item.kind}`) }
  const nextKind = TAMIL_KINDS[TAMIL_KINDS.findIndex(category => category.id === item.kind) + 1]
  const openNext = () => { example.stop(); recording.cancel(); navigate(next ? tamilPracticeHref(next) : nextKind ? `/tamil?kind=${nextKind.id}` : '/tamil?complete=1') }
  const mood = recording.state === 'RECORDING' ? 'listening' : ['GETTING_READY', 'PROCESSING'].includes(recording.state) ? 'processing' : recording.result ? recording.result.correct === true ? 'success' : 'retry' : example.speaking ? 'teaching' : 'idle'
  const pippinTamil = recording.state === 'RECORDING' ? 'மெதுவாகச் சொல்லுங்கள். நான் கேட்கிறேன்!' : recording.state === 'PROCESSING' ? 'உங்கள் ஒலியைக் கவனமாகக் கேட்கிறேன்…' : mood === 'success' ? 'அருமையான முயற்சி!' : mood === 'retry' ? 'பரவாயில்லை. மீண்டும் முயற்சி செய்வோம்!' : example.speaking ? 'எடுத்துக்காட்டைக் கேட்டு, பிறகு முயலுங்கள்.' : 'அவசரம் இல்லை. ஒன்றாகப் பழகலாம்!'
  const pippinEnglish = recording.state === 'RECORDING' ? 'Say it naturally. I’m listening.' : recording.state === 'PROCESSING' ? 'I’m comparing the sounds you made.' : mood === 'success' ? 'Your measured result matched this example.' : mood === 'retry' ? 'That recording did not match yet. Let’s try once more.' : example.speaking ? 'Listen to the example, then have a turn.' : 'There’s no rush. Let’s practise together.'
  return <div className="tamil-practice-page" data-state={recording.state} data-kind={item.kind}>
    <div className="tamil-practice-toolbar"><button className="tamil-text-button" onClick={leave}><ArrowLeft size={17} /><span lang="ta">{kind?.label}</span></button><span>{position + 1} / {peers.length}</span></div>
    <div className="tamil-practice-grid"><section className="tamil-example" aria-labelledby="tamil-example-title"><p className="tamil-overline">{kind?.label} · {kind?.english}</p><TamilLessonVisual item={item} large mood={mood} /><h1 id="tamil-example-title" className={`tamil-prompt-${item.kind}`} lang="ta">{item.text}</h1><details className="tamil-pronunciation-aid"><summary>உச்சரிப்பு உதவி · Pronunciation hint</summary><p>{item.transliteration}</p></details>{item.meaning && <p className="tamil-example-meaning">{item.meaning}</p>}{item.kind === 'vowel' && item.length_label && <p className="tamil-grammar-label" lang="ta">{tamilLengthLabel(item.length_label)} · உயிரெழுத்து</p>}{item.kind === 'vowel' && !['ai', 'au'].includes(item.phoneme_target) && <div className="tamil-duration-rule"><span className={item.length_label === 'kuril' ? 'is-target' : ''}>≤ 1.00 s <b>குறில் · short</b></span><span className={item.length_label === 'nedil' ? 'is-target' : ''}>&gt; 1.00 s <b>நெடில் · long</b></span><small>Only the voiced vowel counts; silence in the recording does not.</small></div>}<p className="tamil-instruction" lang="ta">{item.tip_ta}</p><p className="tamil-muted">{item.tip}</p>
      <div className={`tamil-example-audio ${example.speaking ? 'is-playing' : ''}`}><button className="tamil-button tamil-button-quiet" onClick={example.speaking ? example.stop : example.play} disabled={!example.available || active}><Headphones size={18} /><span lang="ta">{example.speaking ? 'நிறுத்து' : 'தமிழில் கேட்க'}</span><span className="tamil-button-english">{example.speaking ? 'Stop example' : item.audio_kind === 'human_tamil' ? 'Listen to human teacher' : 'Listen to Tamil example'}</span></button>{!example.available && <p className="tamil-voice-unavailable"><span lang="ta">தமிழ் ஒலி எடுத்துக்காட்டு இன்னும் தேவை.</span><small>A Tamil audio example is still needed for this lesson. You can continue with recognition and writing.</small></p>}{example.error && <p className="tamil-notice" role="alert">{example.error}</p>}</div>
      {item.audio_url && <p className="tamil-example-source"><span lang="ta">{item.audio_kind === 'human_tamil' ? 'பதிவு செய்யப்பட்ட தமிழ் குரல் எடுத்துக்காட்டு' : 'உருவாக்கப்பட்ட தமிழ் ஒலி எடுத்துக்காட்டு'}</span><small>{item.audio_kind === 'human_tamil' ? 'Recorded Tamil example' : 'Synthetic Tamil reference'}</small></p>}
    </section><section className="tamil-recording-stage" aria-label="Tamil recording practice"><p className="tamil-overline"><span lang="ta">குரல் பதிவு</span> · VOICE</p>
      {recording.result ? <TamilPracticeResult result={recording.result} onRetry={recording.cancel} onNext={openNext} nextLabel={next ? 'அடுத்த பயிற்சி' : 'பயிற்சிகளுக்குத் திரும்பு'} /> : <><div className="tamil-record-orbit"><div className="tamil-mic-symbol"><Mic size={38} strokeWidth={1.5} /></div><span className="tamil-clock" aria-hidden="true">{recording.remaining.toFixed(1)}<small>s</small></span><p lang="ta">{recording.state === 'RECORDING' ? 'கேட்கிறோம்…' : recording.state === 'PROCESSING' ? 'ஒப்பிடுகிறோம்…' : 'ஏழு நொடிகள்'}</p><div ref={recording.level} className="tamil-level-meter" role="meter" aria-label="Live microphone level" aria-description="Input volume on a logarithmic display scale" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span /></div></div><canvas ref={recording.waveform} width="360" height="60" className="tamil-waveform" role="img" aria-label="Live microphone waveform" /><div className="tamil-record-buttons">{active ? <div className="tamil-auto-status" role="status"><span className="vowel-auto-pulse" aria-hidden="true" /><span lang="ta">{recording.state === 'PROCESSING' ? 'ஒப்பிடுகிறோம்…' : 'பதிவு தானாக நிற்கும்'}</span><small>{recording.state === 'PROCESSING' ? 'Comparing sounds…' : 'Recording finishes automatically'}</small></div> : <button className="tamil-button" onClick={readyToRecord}><Mic size={18} /><span lang="ta">பதிவு செய்</span><span className="tamil-button-english">Start recording</span></button>}<p className="tamil-record-instruction" lang="ta">{recording.state === 'GETTING_READY' ? 'தொடங்க ஒலிவாங்கி அனுமதியை வழங்கவும்.' : recording.state === 'PROCESSING' ? 'பதிவு முடிந்தது. ஒலிகளை ஒப்பிடுகிறோம்.' : 'ஒரு முறை இயல்பாகச் சொல்லுங்கள். பதிவு தானாக நிற்கும்.'}</p><p className="tamil-muted">{recording.state === 'GETTING_READY' ? 'Allow microphone access to begin the seven-second recording.' : recording.state === 'PROCESSING' ? 'Recording complete. Comparing the sounds you made. Your result may still be saved if you leave this page.' : 'Say the example once. Recording stops automatically after seven seconds.'}</p></div></>}
      {recording.error && <div className="tamil-notice" role="alert"><p>{recording.error}</p><button className="tamil-text-button" onClick={recording.cancel}><RotateCcw size={15} /> Try again</button></div>}
      {recording.result && recording.response?.progress && <p className="tamil-saved-note">பதிவான முயற்சிகள் · Saved attempts: {recording.response.progress.total_attempts}</p>}
      <p className="tamil-recording-privacy">Your recording is processed by the server, then discarded. The saved result compares speech sounds with this example.</p>
    </section><TamilPippinCard mood={mood} tamil={pippinTamil} english={pippinEnglish} /></div>
    <div className="tamil-follow-up">
    {!active && <><section className="tamil-quiz-launch"><p className="tamil-overline">அடையாளம் காண்க · RECOGNIZE</p><h2>Check what you learned</h2><p>The question opens without the answer in view.</p><Link className="tamil-button" to={`/tamil/quiz/${encodeURIComponent(item.id)}`}>Start recognition challenge <ArrowRight size={17} /></Link></section>{item.kind !== 'vowel' && <TamilTranscriptPractice item={item} />}</>}
    </div>
    <p className="tamil-status" role="status" aria-live="polite">{STATUS[recording.state]}</p><div className="tamil-bottom-links"><Link to={`/tamil?kind=${item.kind}`}>மேலும் பழகலாம் · Explore more<ArrowRight size={16} /></Link><Link to="/credits">About the voice examples</Link></div>
  </div>
}

export default function TamilPracticePage() {
  const { itemId } = useParams()
  const catalog = useTamilCatalog()
  const item = catalog.items.find(candidate => candidate.id === itemId)
  if (item?.can_evaluate === false) return <TamilStudy key={item.id} item={item} items={catalog.items} />
  return <VowelShell footer={false} className="tamil-world">{catalog.loading ? <p className="tamil-loading" role="status">பயிற்சியைத் திறக்கிறோம்… Loading your example…</p> : catalog.error ? <div className="tamil-practice-page tamil-notice" role="alert"><p>{catalog.error}</p><button className="tamil-button" onClick={catalog.retry}>Retry</button></div> : item ? <TamilPractice key={item.id} item={item} items={catalog.items} /> : <div className="tamil-practice-page tamil-empty"><h1 lang="ta">பயிற்சியைத் தேர்ந்தெடுக்கலாம்.</h1><p>This example could not be found.</p><Link className="tamil-button" to="/tamil">Open Tamil practice<ArrowRight size={18} /></Link></div>}</VowelShell>
}
