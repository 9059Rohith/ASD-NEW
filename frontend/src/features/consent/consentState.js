export const CONSENT_PURPOSES = [
  'recording_retention',
  'clinician_sharing',
  'deidentified_research',
]


export function normalizeConsent(response = {}) {
  return Object.fromEntries(CONSENT_PURPOSES.map((purpose) => [
    purpose,
    Boolean(response.purposes?.[purpose]?.granted),
  ]))
}

