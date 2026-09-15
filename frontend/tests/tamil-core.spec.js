import { expect, test } from '@playwright/test'

const USER = { id: 'tamil-browser-child', email: 'caregiver@example.invalid', full_name: 'Caregiver', child_name: 'Kavi', child_age: 7, role: 'user' }
const items = [
  ['letter-a', 'vowel', 'அ', 'human_tamil'], ['letter-aa', 'vowel', 'ஆ', 'human_tamil'],
  ['letter-i', 'vowel', 'இ', 'human_tamil'], ['letter-ii', 'vowel', 'ஈ', 'human_tamil'],
  ['consonant-zha', 'consonant', 'ழ்'], ['consonant-la', 'consonant', 'ல்'],
  ['consonant-lla', 'consonant', 'ள்'], ['consonant-ra', 'consonant', 'ர்'],
  ['word-amma', 'word', 'அம்மா'], ['word-appa', 'word', 'அப்பா'],
  ['word-maram', 'word', 'மரம்'], ['word-naai', 'word', 'நாய்'],
  ['word-yaanai', 'word', 'யானை'],
  ['sentence-amma-veettil', 'sentence', 'அம்மா வீட்டில் இருக்கிறார்.'],
  ['sentence-naai-odugiradhu', 'sentence', 'நாய் ஓடுகிறது.'],
].map(([id, kind, text, audioKind], index) => ({
  id, kind, text, display_order: index, meaning: kind === 'word' ? { 'word-amma': 'Mother', 'word-appa': 'Father', 'word-maram': 'Tree', 'word-naai': 'Dog', 'word-yaanai': 'Elephant' }[id] : '',
  transliteration: text, tip_ta: 'தமிழில் பழகலாம்.', tip: 'Practise this Tamil example.',
  can_evaluate: kind !== 'consonant', audio_kind: audioKind || null,
  audio_available_human: audioKind === 'human_tamil', audio_url: audioKind ? `/assets/tamil-reference/${id}-human.wav` : null,
}))

function response(body, status = 200) { return { status, contentType: 'application/json', body: JSON.stringify(body) } }

async function mockTamil(page) {
  let gameRounds = 0
  const progress = () => ({ lesson_total: items.length, completed_total: 0, completed_items: [], mastered_items: [],
    recognition_by_item: {}, review_due_items: [], recent_attempts: [], total_attempts: 0,
    scored_attempts: 0, game_total_attempts: gameRounds, by_game: {}, by_kind: Object.fromEntries(
      ['vowel', 'consonant', 'aytham', 'uyirmei', 'word', 'sentence'].map(kind => [kind, { total: items.filter(item => item.kind === kind).length, completed: 0, attempts: 0 }])) })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill(response(USER))
    if (path === '/api/tamil/catalog') return route.fulfill(response({ items }))
    if (path === '/api/tamil/progress') return route.fulfill(response(progress()))
    if (path === '/api/tamil/game-answer') {
      const payload = route.request().postDataJSON()
      const correct = payload.selected_id === payload.item_id || payload.written_text === items.find(item => item.id === payload.item_id)?.text
      gameRounds += 1
      return route.fulfill(response({ attempt: { ...payload, correct, score: correct ? 10 : 0 }, already_saved: false, progress: progress() }))
    }
    if (path === '/api/tamil-reports/config') return route.fulfill(response({ enabled: false, consent: false, delivery_status: 'Not configured' }))
    if (path === '/api/tamil-reports/preview') return route.fulfill(response({ day: '2026-09-14', timezone: 'Asia/Kolkata', practice_attempts: 0, game_rounds: gameRounds }))
    if (path === '/api/tamil-reports/history') return route.fulfill(response({ reports: [] }))
    return route.fulfill(response({ detail: 'Browser fixture: not used' }, 503))
  })
}

test('landing butterflies respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/auth/me', route => route.fulfill(response({ detail: 'No session' }, 401)))
  await page.goto('/')
  await expect(page.locator('.app-butterfly')).toHaveCount(6)
  await expect(page.locator('.app-butterfly-garden')).toHaveAttribute('data-playing', 'false')
  await expect(page.locator('.app-butterfly').first()).toHaveCSS('animation-name', 'none')
  await expect(page.getByRole('heading', { name: /find.*your.*voice/i })).toBeVisible()
})

test('randomized butterflies remain across training and games and pause in hidden tabs', async ({ page }) => {
  await mockTamil(page)
  await page.goto('/training')
  const garden = page.locator('.app-butterfly-garden')
  await expect(garden).toHaveAttribute('data-playing', 'true')
  await expect(garden.locator('.app-butterfly')).toHaveCount(6)
  const starts = await garden.locator('.app-butterfly').evaluateAll(nodes => nodes.map(node => node.style.getPropertyValue('--start-x')))
  expect(new Set(starts).size).toBeGreaterThan(3)
  await expect(garden.locator('.app-butterfly').first()).toHaveCSS('animation-name', 'app-butterfly-flight')
  await expect(garden).toHaveCSS('pointer-events', 'none')
  await page.goto('/games')
  await expect(page.locator('.app-butterfly')).toHaveCount(6)
  await expect(page.locator('.app-butterfly-garden')).toHaveAttribute('data-playing', 'true')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.app-butterfly-garden')).toHaveAttribute('data-playing', 'false')
})

test('three ordered training sections open the selected lesson', async ({ page }) => {
  await mockTamil(page)
  await page.goto('/training')
  await expect(page.locator('.tamil-primary-sections button')).toHaveCount(3)
  await page.locator('.tamil-primary-sections button').nth(1).click()
  await expect(page.locator('.tamil-grid-word .tamil-learning-card')).toHaveCount(5)
  await expect(page.locator('.tamil-grid-word .tamil-learning-card').first()).toContainText('அம்மா')
  await page.locator('.tamil-grid-word .tamil-learning-card').first().click()
  await expect(page).toHaveURL(/\/tamil\/practice\/word-amma$/)
  await expect(page.locator('.tamil-lesson-picture.is-large')).toHaveAttribute('src', '/assets/words/amma.png')
  await page.goto('/training?kind=sentence')
  await expect(page.locator('.tamil-grid-sentence .tamil-learning-card')).toHaveCount(2)
  await expect(page.locator('.tamil-grid-sentence .tamil-learning-card').first()).toContainText('அம்மா வீட்டில் இருக்கிறார்.')
})

test('all five core games save rounds and appear in progress', async ({ page }) => {
  await mockTamil(page)
  await page.goto('/games')
  await expect(page.locator('.tamil-game-tile')).toHaveCount(5)
  const rounds = [
    ['letter-match', 'அ'], ['find-letter', 'ழ்'],
    ['picture-word-match', 'அம்மா'], ['listen-choose', 'அ'],
  ]
  for (const [slug, choice] of rounds) {
    await page.locator('.tamil-game-tile').filter({ has: page.locator(`.tamil-game-mark`) }).filter({ hasText: slug === 'letter-match' ? 'Letter Match' : slug === 'find-letter' ? 'Find the Letter' : slug === 'picture-word-match' ? 'Picture → Word Match' : 'Listen & Choose' }).click()
    if (slug === 'letter-match') {
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      await expect(page.getByText('Your current round is paused.')).toBeVisible()
      await page.getByRole('button', { name: 'Resume game' }).click()
    }
    await page.locator('.tamil-game-choices button').filter({ hasText: choice }).first().click()
    await expect(page.locator('.tamil-game-feedback')).toContainText('Wonderful')
    await page.getByRole('button', { name: 'All games' }).click()
  }
  await page.locator('.tamil-game-tile').filter({ hasText: 'Word Builder' }).click()
  for (const part of ['அ', 'ம்', 'மா']) await page.locator('.tamil-game-choices button').filter({ hasText: part }).first().click()
  await page.getByRole('button', { name: 'Check word' }).click()
  await expect(page.locator('.tamil-game-feedback')).toContainText('Wonderful')
  await page.goto('/progress')
  await expect(page.getByText('Saved game rounds')).toBeVisible()
  await expect(page.locator('.tamil-progress-summary')).toContainText('5')
})
