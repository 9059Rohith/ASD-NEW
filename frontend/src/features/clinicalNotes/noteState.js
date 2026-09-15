export function validateNoteDraft(draft) {
  if (!(draft.text || '').trim()) return { valid: false, message: 'Add a clinical note.' }
  return { valid: true, message: null }
}


export function noteDraftToPayload(draft) {
  return {
    text: draft.text.trim(),
    next_target: (draft.nextTarget || '').trim() || null,
    caregiver_visible: Boolean(draft.caregiverVisible),
  }
}
