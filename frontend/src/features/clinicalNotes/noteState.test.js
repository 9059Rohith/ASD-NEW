import { describe, expect, it } from 'vitest'

import { noteDraftToPayload, validateNoteDraft } from './noteState'


describe('clinical note drafts', () => {
  it('rejects an empty note', () => {
    expect(validateNoteDraft({ text: ' ', nextTarget: '' })).toEqual({
      valid: false,
      message: 'Add a clinical note.',
    })
  })

  it('normalizes a valid payload', () => {
    const draft = { text: '  Practise slowly. ', nextTarget: ' அம்மா ', caregiverVisible: true }

    expect(validateNoteDraft(draft)).toEqual({ valid: true, message: null })
    expect(noteDraftToPayload(draft)).toEqual({
      text: 'Practise slowly.',
      next_target: 'அம்மா',
      caregiver_visible: true,
    })
  })
})
