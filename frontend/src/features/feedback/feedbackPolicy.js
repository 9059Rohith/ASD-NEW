const tier = (definition) => Object.freeze({
  ...definition,
  messages: Object.freeze(definition.messages),
  effects: Object.freeze(definition.effects),
})

export const FEEDBACK_TIERS = Object.freeze([
  tier({
    id: 'sprout', min: 0, max: 20, heading: 'Nice Try!',
    messages: ['That was a good first attempt!', 'You started strong!', 'Every sound helps you grow!'],
    effects: ['sparkles', 'stars'], sound: 'sparkle', animalAction: 'wave',
    stars: 1, coins: 2, accent: '#34b983', soft: '#eafaf3', button: 'Try Again',
  }),
  tier({
    id: 'bloom', min: 21, max: 40, heading: 'Great Effort!',
    messages: ['You are getting closer!', 'Your voice is growing stronger!', 'Wonderful effort—keep going!'],
    effects: ['sparkles', 'stars', 'bubbles', 'butterflies'], sound: 'bubble', animalAction: 'bounce',
    stars: 1, coins: 4, accent: '#22a9c5', soft: '#e9faff', button: 'Try Once More',
  }),
  tier({
    id: 'shine', min: 41, max: 60, heading: 'Awesome!',
    messages: ["You're improving!", 'That sounded clearer!', 'Fantastic speaking practice!'],
    effects: ['sparkles', 'stars', 'bubbles', 'butterflies', 'confetti', 'rainbow'], sound: 'chime', animalAction: 'jump',
    stars: 2, coins: 6, accent: '#7165e8', soft: '#f0efff', button: 'Try Again',
  }),
  tier({
    id: 'star', min: 61, max: 80, heading: 'Excellent!',
    messages: ['So close!', 'Your careful practice is shining!', 'Excellent speaking!'],
    effects: ['sparkles', 'stars', 'bubbles', 'butterflies', 'confetti', 'rainbow', 'balloons', 'hearts'], sound: 'clap', animalAction: 'dance',
    stars: 2, coins: 8, accent: '#f09b32', soft: '#fff7e8', button: 'Make It Shine',
  }),
  tier({
    id: 'gold', min: 81, max: 94, heading: 'Fantastic!',
    messages: ['Almost perfect!', 'Your Tamil sounds wonderful!', 'Amazing job—what a clear voice!'],
    effects: ['sparkles', 'stars', 'bubbles', 'butterflies', 'confetti', 'rainbow', 'balloons', 'hearts', 'flowers', 'gold'], sound: 'bell', animalAction: 'clap',
    stars: 3, coins: 10, accent: '#e4a516', soft: '#fff9df', button: 'Try for Perfect',
  }),
  tier({
    id: 'ultimate', min: 95, max: 100, heading: 'You Did It!',
    messages: ['Perfect pronunciation!', 'Amazing—your voice sparkled!', 'Excellent Tamil speaking!'],
    effects: ['sparkles', 'stars', 'bubbles', 'butterflies', 'confetti', 'rainbow', 'balloons', 'hearts', 'flowers', 'gold', 'fireworks', 'trophy', 'crown', 'coins'], sound: 'victory', animalAction: 'celebrate',
    stars: 3, coins: 15, accent: '#f0ad20', soft: '#fff6cf', button: 'Celebrate Again',
  }),
])

export function normalizeAccuracy(accuracy) {
  const numeric = Number(accuracy)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, numeric))
}

export function getFeedbackProfile(accuracy, messageSeed = 0) {
  const score = normalizeAccuracy(accuracy)
  const definition = FEEDBACK_TIERS.find((item) => score >= item.min && score <= item.max) || FEEDBACK_TIERS[0]
  const numericSeed = Number(messageSeed)
  const index = Math.abs(Math.trunc(Number.isFinite(numericSeed) ? numericSeed : score)) % definition.messages.length
  return { ...definition, accuracy: score, message: definition.messages[index] }
}
