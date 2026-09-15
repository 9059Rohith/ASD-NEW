export default function PhonemeBreakdown({ result }) {
  if (!result) return null
  if (result.vowel_analysis) {
    const vowel = result.vowel_analysis
    const target = [vowel.target_identity, vowel.target_length].filter(Boolean).join(' · ')
    const heard = [vowel.identity, vowel.length_validation === 'ambiguous' ? 'timing unclear' : vowel.length].filter(Boolean).join(' · ')
    return (
      <section aria-label="Vowel analysis" className="mb-5 space-y-3 rounded-2xl border border-slate-200 p-4">
        <h4 className="font-bold">Vowel sound &amp; length</h4>
        <p className="text-sm">Target: <strong>{target || 'One vowel'}</strong></p>
        <p className="text-sm">Detected: <strong>{heard || 'No clear vowel yet'}</strong></p>
        {result.scorable && <p className="text-sm">{vowel.identity_match ? 'Sound matched' : 'Sound needs practice'} · {vowel.length_match ? 'Length matched' : 'Length needs practice'}</p>}
        {vowel.duration_seconds != null && <p className="text-sm">Vowel held for {vowel.duration_seconds.toFixed(2)} seconds. Over 1.00 second is long; 1.00 second or less is short.</p>}
        {result.scorable === false && vowel.strong_duration_seconds != null && <p className="text-sm">Clear sound: {vowel.strong_duration_seconds.toFixed(2)} seconds.</p>}
        <p className="text-xs text-slate-600">Both sound and length must match to complete this step.</p>
        {result.audio_quality?.warnings?.map(warning => <p key={warning} className="text-sm text-amber-800">{warning}</p>)}
      </section>
    )
  }
  if (result.score_method === 'diphthong_identity_match_v1') {
    return <section aria-label="Vowel analysis" className="mb-5 space-y-3 rounded-2xl border border-slate-200 p-4">
      <h4 className="font-bold text-slate-900">Vowel sound</h4>
      <p className="text-sm">Target: <strong>{result.target_phoneme?.toUpperCase()}</strong></p>
      <p className="text-sm">Detected: <strong>{result.detected_vowel || 'No clear vowel yet'}</strong></p>
      <p className="text-xs text-slate-600">The sound must match the target to complete this step.</p>
      {result.audio_quality?.warnings?.map(warning => <p key={warning} className="text-sm text-amber-800">{warning}</p>)}
    </section>
  }
  return (
    <section aria-label="Phoneme analysis" className="mb-5 space-y-3 rounded-2xl border border-slate-200 p-4">
      <h4 className="font-bold">Speech sounds (IPA)</h4>
      <p className="text-sm">Target: <strong>{result.expected_phonemes?.join(' ') || '—'}</strong></p>
      <p className="text-sm">Detected: <strong>{result.actual_phonemes?.join(' ') || 'No stable sounds detected'}</strong></p>
      {result.scorable && <>
        <p className="text-sm">{result.correct_phonemes}/{result.total_phonemes} target sounds matched.</p>
        <ul className="space-y-1 text-sm">
          {result.phoneme_alignment?.map((row, index) => (
            <li key={index} className={row.operation === 'correct' ? 'text-emerald-700' : 'text-amber-800'}>
              /{row.expected || '—'}/ → /{row.actual || '—'}/ · {row.operation}
            </li>
          ))}
        </ul>
        {result.confidence != null && <p className="text-xs text-slate-600">Model token confidence: {Math.round(result.confidence * 100)}%. This is not a pronunciation probability.</p>}
        <p className="text-xs text-slate-600">Score = 100 × (1 − phoneme edits ÷ target sounds), bounded to 0–100. Automatic speech practice feedback; model errors are possible.</p>
      </>}
      {result.audio_quality?.warnings?.map(warning => <p key={warning} className="text-sm text-amber-800">{warning}</p>)}
    </section>
  )
}
