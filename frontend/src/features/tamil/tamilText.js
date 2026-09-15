/** Normalize only for comparison; callers keep the original transcript for display. */
export function normalizeTamilText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function editDistance(expected, actual) {
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index)
  for (let row = 1; row <= expected.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= actual.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (expected[row - 1] === actual[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[actual.length]
}

export function compareTamilText(expectedText, recognizedText) {
  const expected = normalizeTamilText(expectedText)
  const recognized = normalizeTamilText(recognizedText)
  const expectedUnits = Array.from(expected)
  const recognizedUnits = Array.from(recognized)
  const distance = editDistance(expectedUnits, recognizedUnits)
  const length = Math.max(expectedUnits.length, recognizedUnits.length)
  const similarity = length ? Math.max(0, 1 - distance / length) : 0
  return {
    expected,
    recognized,
    correct: Boolean(expected && recognized && distance === 0),
    score: Math.round(similarity * 100),
    editDistance: distance,
  }
}
