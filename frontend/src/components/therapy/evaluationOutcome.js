export function isSuccessfulResult(result) {
  if (!result || result.scorable === false) return false
  if (result.score_method === 'real-data-independent-vowel-v1' ||
      result.score_method === 'diphthong_identity_match_v1') {
    return result.scorable === true && result.phoneme_match === true
  }
  return Boolean(result.phoneme_match || result.accuracy >= 70)
}
