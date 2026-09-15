import { describe, expect, it } from 'vitest'

import { CONSENT_PURPOSES, normalizeConsent } from './consentState'


describe('normalizeConsent', () => {
  it('defaults every optional purpose to denied', () => {
    expect(normalizeConsent({ purposes: {} })).toEqual({
      recording_retention: false,
      clinician_sharing: false,
      deidentified_research: false,
    })
  })

  it('reads boolean grant state and ignores unknown purposes', () => {
    expect(normalizeConsent({ purposes: {
      recording_retention: { granted: true },
      clinician_sharing: { granted: false },
      advertising: { granted: true },
    } })).toEqual({
      recording_retention: true,
      clinician_sharing: false,
      deidentified_research: false,
    })
    expect(CONSENT_PURPOSES).not.toContain('advertising')
  })
})
