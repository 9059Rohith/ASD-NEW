import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResultCard, SessionSummary } from './VowelStudio'

describe('vowel studio result flows', () => {
  it('lets an abstention retry without displaying a fabricated zero score or continue action', () => {
    const html = renderToStaticMarkup(<ResultCard mode="practice" result={{ scorable: false, accuracy: 0, feedback: 'No vowel was heard.' }} />)
    expect(html).toContain('No vowel was heard.')
    expect(html).toContain('Try again')
    expect(html).not.toContain('Finish practice')
    expect(html).not.toContain('out of 100')
    expect(html).not.toContain('Confidence')
  })
  it('allows a completed listening answer to continue without a pronunciation score', () => {
    const html = renderToStaticMarkup(<ResultCard mode="match-sound" result={{ kind: 'listening', scorable: false, accuracy: null, correct: false, identity: 'A', length: 'long', target_identity: 'E', target_length: 'short', feedback: 'Listen for the shorter E.' }} />)
    expect(html).toContain('Continue')
    expect(html).toContain('நீங்கள் தேர்ந்தெடுத்தது ஆ (நெடில்). கேட்ட ஒலி எ (குறில்).')
    expect(html).not.toContain('Try again')
    expect(html).not.toContain('out of 100')
    expect(html).not.toContain('Vowel duration')
  })
  it('shows actual vowel duration independently of the capture window and encourages low scores', () => {
    const html = renderToStaticMarkup(<ResultCard mode="practice" result={{ scorable: true, accuracy: 32, vowel_analysis: { identity: 'E', length: 'short', duration_seconds: .42, confidence: .81 }, feedback: 'Try holding the vowel a little longer.' }} />)
    expect(html).toContain('0.42 s')
    expect(html).toContain('81%')
    expect(html).toContain('32 out of 100')
    expect(html).toContain('Try again')
    expect(html).toContain('Finish practice')
    expect(html).not.toContain('Failed')
  })
  it('does not offer scored question retries in an evaluation', () => {
    const html = renderToStaticMarkup(<ResultCard mode="evaluate" result={{ scorable: true, accuracy: 35 }} />)
    expect(html).toContain('Continue')
    expect(html).not.toContain('Try again')
  })
  it('celebrates exactly 100 with a distinct earned reward', () => {
    const html = renderToStaticMarkup(<ResultCard mode="practice" result={{ scorable: true, accuracy: 100, success: true, celebration: 'perfect', xp_earned: 50 }} />)
    expect(html).toContain('A perfect little moment!')
    expect(html).toContain('Perfect sound badge')
    expect(html).toContain('50 XP earned')
  })
  it('does not reveal diagnostic fields in the normal result', () => {
    const result = { scorable: true, accuracy: 95, debug_features: { f0_hz: 200 } }
    expect(renderToStaticMarkup(<ResultCard mode="practice" result={result} />)).not.toContain('Development measurements')
    expect(renderToStaticMarkup(<ResultCard mode="practice" result={result} debug />)).toContain('Development measurements')
  })
  it('converts weighted component points to percentages in the saved summary', () => {
    const html = renderToStaticMarkup(<SessionSummary mode="speed-round" data={{ summary: { average_score: 75, successful_challenges: 7, challenge_count: 10, component_averages: { identity: 32, duration: 21, pronunciation: 16, consistency: 8 } } }} />)
    expect(html).toContain('7 of 10 challenges matched.')
    expect(html).toContain('80%')
    expect(html).toContain('70%')
  })
})
