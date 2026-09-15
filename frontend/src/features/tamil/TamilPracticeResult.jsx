import { useEffect, useRef } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { hasTamilScore, phonemeText } from './tamilLearning'

const OPERATIONS = { correct: 'பொருந்தியது', substitution: 'வேறுபட்டது', deletion: 'கேட்கவில்லை', insertion: 'கூடுதல் ஒலி' }

export default function TamilPracticeResult({ result, onRetry, onNext, nextLabel }) {
  const scored = hasTamilScore(result)
  const correct = scored && result.correct === true
  const diphthong = result.score_method === 'diphthong_identity_match_v1'
  const pairedVowel = result.score_method === 'real-data-independent-vowel-v1'
  const tamilTranscript = result.score_method === 'tamil_text_similarity_v1'
  const pairedKey = `${String(result.vowel_analysis?.identity || '').toLowerCase()}${result.vowel_analysis?.length === 'long' ? 'long' : 'short'}`
  const detectedVowel = pairedVowel
    ? { ashort: 'அ', along: 'ஆ', ishort: 'இ', ilong: 'ஈ', ushort: 'உ', ulong: 'ஊ', eshort: 'எ', elong: 'ஏ', oshort: 'ஒ', olong: 'ஓ' }[pairedKey]
    : { A: 'அ / ஆ', I: 'இ / ஈ', U: 'உ / ஊ', E: 'எ / ஏ', O: 'ஒ / ஓ', AI: 'ஐ', AU: 'ஔ', OTHER: 'வேறு உயிரொலி' }[result.detected_vowel]
  const voicedSeconds = pairedVowel ? result.vowel_analysis?.duration_seconds : Number.isFinite(result.active_duration_ms) ? result.active_duration_ms / 1000 : null
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [result])
  return <section className="tamil-result" aria-labelledby="tamil-result-title">
    <p className="tamil-overline">உங்கள் முயற்சி · YOUR ATTEMPT</p>
    <h2 id="tamil-result-title" ref={heading} tabIndex={-1} lang="ta">{correct ? 'சரி! அருமையாகச் சொன்னீர்கள்.' : 'மீண்டும் முயற்சி செய்யலாம்.'}</h2>
    {scored && <p className={`tamil-verdict ${correct ? 'is-correct' : 'is-retry'}`}><strong lang="ta">{correct ? 'சரி' : 'மீண்டும் முயற்சி'}</strong><span>{correct ? 'Correct' : 'Try Again'}</span></p>}
    {scored ? <div className="tamil-score"><strong>{Math.round(result.accuracy)}<small> / 100</small></strong><div><b lang="ta">{tamilTranscript ? 'முழுச் சொல் பொருத்தம்' : diphthong || pairedVowel ? 'உயிரொலி பொருத்தம்' : 'ஒலிக்கூறு ஒப்பீடு'}</b><span>{tamilTranscript ? 'Complete phrase match' : diphthong || pairedVowel ? 'Vowel identity match' : 'Phoneme comparison'}</span></div></div> : <p className="tamil-unscored"><span lang="ta">இந்த முயற்சிக்கு மதிப்பெண் வழங்கப்படவில்லை.</span><br />This attempt could not be scored confidently.</p>}
    <p className="tamil-result-feedback">{typeof result.feedback === 'string' ? result.feedback : 'Say the example once, naturally, then leave a little quiet.'}</p>
    {scored && <>
      {(diphthong || pairedVowel) && detectedVowel && <p className="tamil-detected-vowel">கண்டறிந்த உயிரொலி · Detected vowel: <strong lang="ta">{detectedVowel}</strong>{Number.isFinite(voicedSeconds) && <span> · {voicedSeconds.toFixed(2)} s voiced</span>}</p>}
      {tamilTranscript && <div className="tamil-recognized-text"><span>Recognized Tamil</span><p lang="ta">{result.recognized_text || '—'}</p></div>}
      {!pairedVowel && !tamilTranscript && <div className="tamil-phoneme-comparison"><div><h3>எதிர்பார்க்கும் ஒலிகள் <small>Expected sounds</small></h3><p>{phonemeText(result.expected_phonemes)}</p></div><div><h3>கண்டறிந்த ஒலிகள் <small>Detected sounds</small></h3><p>{phonemeText(result.actual_phonemes)}</p></div></div>}
      <p className="tamil-method-note">{tamilTranscript ? 'The Tamil speech recognizer compares the complete normalized word or sentence. Harmless spacing and punctuation are ignored.' : diphthong ? 'This score checks whether the detected vowel matches the prompt. A match earns 100 points; it does not mean perfect pronunciation.' : pairedVowel ? 'The model identifies the vowel sound. Measured voicing over 1.00 second is long; otherwise it is short. Silence is excluded. This is educational feedback, not a clinical assessment.' : 'These sound symbols show a phoneme comparison, not a Tamil transcript or a clinical assessment.'}</p>
      {Number.isFinite(result.confidence) && <p className="tamil-confidence">மாதிரியின் நம்பிக்கை · Model confidence: <b>{Math.round(result.confidence * 100)}%</b><br />{diphthong ? 'Confidence measures the model’s certainty separately from the match points.' : 'Confidence describes the detected sounds; the score compares their sequence.'}</p>}
      {Array.isArray(result.phoneme_alignment) && result.phoneme_alignment.length > 0 && <details className="tamil-alignment"><summary>ஒவ்வொரு ஒலியையும் பார்க்க · Review each sound</summary><div className="tamil-table-wrap"><table><thead><tr><th>Expected</th><th>Detected</th><th>Comparison</th></tr></thead><tbody>{result.phoneme_alignment.map((sound, index) => <tr key={index}><td>{sound.expected || '—'}</td><td>{sound.actual || '—'}</td><td><span lang="ta">{OPERATIONS[sound.operation] || 'ஒப்பீடு'}</span><small>{sound.operation}</small></td></tr>)}</tbody></table></div></details>}
    </>}
    <div className="tamil-actions"><button className="tamil-button" onClick={onRetry}><RotateCcw size={17} /><span lang="ta">மீண்டும் முயற்சி</span><span className="tamil-button-english">Try again</span></button>{scored && onNext && <button className="tamil-button tamil-button-quiet" onClick={onNext}><span lang="ta">{nextLabel || 'அடுத்த பயிற்சி'}</span><ArrowRight size={17} /></button>}</div>
  </section>
}
