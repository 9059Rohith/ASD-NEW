export function reviewSignalFor(accuracy) {
  const score = Number(accuracy) || 0
  if (score < 50) return 'Review next'
  if (score < 80) return 'Developing'
  return 'Stable'
}


export function buildEvidenceRows(byPhoneme = []) {
  return byPhoneme
    .map((item) => ({
      phoneme: item.phoneme,
      accuracy: Math.round(Number(item.accuracy) || 0),
      attempts: Number(item.attempts) || 0,
      signal: reviewSignalFor(item.accuracy),
    }))
    .sort((left, right) => left.accuracy - right.accuracy)
}
