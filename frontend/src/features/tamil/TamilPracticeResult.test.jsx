import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TamilPracticeResult from './TamilPracticeResult'

describe('Tamil speech comparison result', () => {
  it('shows detected phonemes and comparison points without claiming a Tamil transcript', () => {
    const html = renderToStaticMarkup(<TamilPracticeResult result={{ scorable: true, accuracy: 75, confidence: .82, feedback: 'Compare the last sound.', expected_phonemes: ['a', 'm', 'aː'], actual_phonemes: ['a', 'm', 'a'], phoneme_alignment: [{ expected: 'aː', actual: 'a', operation: 'substitution' }] }} />)
    expect(html).toContain('Phoneme comparison')
    expect(html).toContain('a m aː')
    expect(html).toContain('a m a')
    expect(html).toContain('82%')
    expect(html).toContain('not a Tamil transcript or a clinical assessment')
    expect(html).not.toContain('duration_seconds')
    expect(html).not.toContain('Short / long')
  })
  it('does not give an uncertain recording a fabricated zero or confidence', () => {
    const html = renderToStaticMarkup(<TamilPracticeResult result={{ scorable: false, accuracy: null, confidence: null, feedback: 'No speech was heard.' }} />)
    expect(html).toContain('This attempt could not be scored confidently.')
    expect(html).toContain('Try again')
    expect(html).toContain('No speech was heard.')
    expect(html).not.toContain('/ 100')
    expect(html).not.toContain('Model confidence')
  })
  it('separates a diphthong identity match from pronunciation and confidence', () => {
    const html = renderToStaticMarkup(<TamilPracticeResult result={{ scorable: true, accuracy: 100, confidence: .73, detected_vowel: 'AU', active_duration_ms: 540, score_method: 'diphthong_identity_match_v1', expected_phonemes: ['aʊ'], actual_phonemes: ['aʊ'] }} />)
    expect(html).toContain('Vowel identity match')
    expect(html).toContain('ஔ')
    expect(html).toContain('0.54 s voiced')
    expect(html).toContain('73%')
    expect(html).toContain('does not mean perfect pronunciation')
    expect(html).not.toContain('the score compares their sequence')
  })
  it('states correct or try again from the centralized server decision', () => {
    const correct = renderToStaticMarkup(<TamilPracticeResult result={{ scorable: true, correct: true, accuracy: 100, feedback: 'Matched.', expected_phonemes: ['a'], actual_phonemes: ['a'] }} />)
    const retry = renderToStaticMarkup(<TamilPracticeResult result={{ scorable: true, correct: false, accuracy: 75, feedback: 'Try once more.', expected_phonemes: ['a'], actual_phonemes: ['i'] }} />)
    expect(correct).toContain('Correct')
    expect(correct).toContain('சரி')
    expect(retry).toContain('Try Again')
    expect(retry).toContain('மீண்டும் முயற்சி')
  })
  it('shows the paired model vowel and measured duration', () => {
    const html = renderToStaticMarkup(<TamilPracticeResult result={{ scorable: true, correct: false, accuracy: 40, score_method: 'real-data-independent-vowel-v1', vowel_analysis: { identity: 'I', length: 'long', duration_seconds: .82 }, feedback: 'Hold the target.' }} />)
    expect(html).toContain('Detected vowel')
    expect(html).toContain('ஈ')
    expect(html).toContain('0.82 s voiced')
  })
  it('shows the Tamil ASR result as complete-text recognition', () => {
    const html = renderToStaticMarkup(<TamilPracticeResult result={{ scorable: true, correct: true, accuracy: 100, score_method: 'tamil_text_similarity_v1', recognized_text: 'நாய் ஓடுகிறது', feedback: 'Matched.' }} />)
    expect(html).toContain('Recognized Tamil')
    expect(html).toContain('நாய் ஓடுகிறது')
    expect(html).toContain('Complete phrase match')
    expect(html).not.toContain('Phoneme comparison')
  })
})
