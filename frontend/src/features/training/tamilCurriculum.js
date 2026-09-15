const COLORS = [
  'from-violet-500 to-indigo-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600', 'from-cyan-500 to-blue-600',
]

const vowelRows = [
  ['அ', 'A', 'a', 'அம்மா', 'Amma (Mother)', 'Open your mouth gently for the short அ sound.'],
  ['ஆ', 'AA', 'aa', 'ஆடு', 'Aadu (Goat)', 'Hold the open ஆ sound a little longer.'],
  ['இ', 'I', 'i', 'இலை', 'Ilai (Leaf)', 'Smile slightly for the short இ sound.'],
  ['ஈ', 'II', 'ii', 'ஈ', 'Ee (Fly)', 'Stretch the long ஈ sound smoothly.'],
  ['உ', 'U', 'u', 'உப்பு', 'Uppu (Salt)', 'Round your lips gently for the short உ sound.'],
  ['ஊ', 'UU', 'uu', 'ஊஞ்சல்', 'Ūñcal (Swing)', 'Hold the rounded ஊ sound a little longer.'],
  ['எ', 'E', 'e', 'எலி', 'Eli (Mouse)', 'Keep your jaw relaxed for the short எ sound.'],
  ['ஏ', 'EE', 'ee', 'ஏணி', 'Ēṇi (Ladder)', 'Stretch the clear ஏ sound smoothly.'],
  ['ஐ', 'AI', 'ai', 'ஐந்து', 'Ainthu (Five)', 'Glide clearly through the ஐ sound.'],
  ['ஒ', 'O', 'o', 'ஒன்று', 'Ondru (One)', 'Round your lips for the short ஒ sound.'],
  ['ஓ', 'OO', 'oo', 'ஓடு', 'Odu (Run)', 'Hold the rounded ஓ sound smoothly.'],
  ['ஔ', 'AU', 'au', 'ஔவை', 'Avvai', 'Open and round your mouth through the ஔ sound.'],
]

const wordRows = [
  ['அம்மா', 'AMMA', 'amma', 'Mother', 'Say அம், then finish with a long மா.'],
  ['அப்பா', 'APPA', 'appa', 'Father', 'Say அப், then finish with a long பா.'],
  ['மரம்', 'MARAM', 'maram', 'Tree', 'Say ம-ரம் slowly, then join the sounds.'],
  ['பழம்', 'PAZHAM', 'pazham', 'Fruit', 'Curl the tongue gently for the ழ sound in பழம்.'],
]

const WORD_IMAGES = Object.freeze({
  amma: '/assets/words/amma.png',
  appa: '/assets/words/appa.png',
  maram: '/assets/words/maram.png',
  pazham: '/assets/words/pazham.png',
})

// Complete Tamil example sentences, not English glosses mislabeled as sentences.
const EXAMPLE_SENTENCES = Object.freeze({
  a: 'அம்மா, வா.', aa: 'இது ஆடு.', i: 'இது இலை.', ii: 'ஈ பறக்கிறது.',
  u: 'இது உப்பு.', uu: 'ஊஞ்சல் ஆடுகிறது.', e: 'எலி ஓடுகிறது.', ee: 'இது ஏணி.',
  ai: 'இவை ஐந்து பழங்கள்.', o: 'ஒன்று முதல் ஐந்து வரை எண்ணு.',
  oo: 'மெதுவாக ஓடு.', au: 'ஔவை ஒரு தமிழ்ப் புலவர்.',
  amma: 'அம்மா வீட்டில் இருக்கிறார்.', appa: 'அப்பா, வா.', maram: 'இது மரம்.', pazham: 'இது பழம்.',
})

export const TAMIL_VOWELS = Object.freeze(vowelRows.map(([symbol, english, phoneme, example, wordEn, tip], index) => Object.freeze({
  id: index + 1,
  type: 'letter',
  symbol,
  tamil: symbol,
  english,
  phoneme,
  roman: ({ a: 'a', aa: 'aa', i: 'i', ii: 'ee', u: 'u', uu: 'oo', e: 'e', ee: 'ē', ai: 'ai', o: 'o', oo: 'ō', au: 'au' })[phoneme],
  word: example,
  wordEn,
  sentence: EXAMPLE_SENTENCES[phoneme],
  vowelClass: ['a', 'i', 'u', 'e', 'o'].includes(phoneme) ? 'குறில்' : 'நெடில்',
  tip,
  color: COLORS[index % COLORS.length],
  voice_key: `lesson_${index + 1}`,
  voice_language: 'ta-IN',
})))

export const TAMIL_WORDS = Object.freeze(wordRows.map(([symbol, english, phoneme, meaning, tip], index) => Object.freeze({
  id: index + 13,
  type: 'word',
  symbol,
  tamil: symbol,
  english,
  phoneme,
  word: symbol,
  wordEn: `${english} (${meaning})`,
  sentence: EXAMPLE_SENTENCES[phoneme],
  tip,
  color: COLORS[(index + 12) % COLORS.length],
  voice_key: `lesson_${index + 13}`,
  voice_language: 'ta-IN',
  image: WORD_IMAGES[phoneme],
})))

export const TAMIL_TRAINING_ITEMS = Object.freeze([...TAMIL_VOWELS, ...TAMIL_WORDS])
