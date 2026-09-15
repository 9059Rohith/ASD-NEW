import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PhonemeBreakdown from './PhonemeBreakdown'

describe('training sound analysis', () => {
  it('explains the detected vowel and length without showing an IPA edit formula', () => {
    const html = renderToStaticMarkup(<PhonemeBreakdown result={{
      score_method: 'real-data-independent-vowel-v1', scorable: true,
      vowel_analysis: { target_identity: 'A', target_length: 'short', identity: 'A',
        length: 'long', identity_match: true, length_match: false, duration_seconds: 0.48 },
    }} />)
    expect(html).toContain('Vowel sound &amp; length')
    expect(html).toContain('A · short')
    expect(html).toContain('A · long')
    expect(html).toContain('Length needs practice')
    expect(html).not.toContain('phoneme edits')
  })

  it('shows the clear sound timing when vowel length cannot be scored', () => {
    const html = renderToStaticMarkup(<PhonemeBreakdown result={{
      score_method: 'real-data-independent-vowel-v1', scorable: false,
      vowel_analysis: { target_identity: 'E', target_length: 'long', identity: 'E',
        length: 'long', length_validation: 'ambiguous', duration_seconds: 0.54, strong_duration_seconds: 0.46 },
    }} />)
    expect(html).toContain('Clear sound: 0.46 seconds')
    expect(html).toContain('timing unclear')
    expect(html).not.toContain('Length matched')
  })
})
