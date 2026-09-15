/** Keep distractors in the same learning family so each answer is meaningful. */
export function tamilQuizOptions(item, catalog, count = 4) {
  const peers = catalog.filter(candidate => candidate.kind === item.kind &&
    (item.kind !== 'uyirmei' || candidate.consonant_id === item.consonant_id))
  const index = peers.findIndex(candidate => candidate.id === item.id)
  if (index < 0) return []
  const start = Math.min(Math.max(0, index - 1), Math.max(0, peers.length - count))
  return peers.slice(start, start + count)
}

export function tamilQuizPrompt(item) {
  if (item.kind === 'word') return `Which Tamil word means “${item.meaning}”?`
  if (item.kind === 'sentence') return `Which Tamil sentence means “${item.meaning}”?`
  return `Which Tamil character makes the “${item.transliteration}” sound?`
}
