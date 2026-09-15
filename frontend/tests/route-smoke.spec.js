import { expect, test } from '@playwright/test'

// Use the full Chromium engine for this long navigation sequence.
test.use({ channel: 'chromium', launchOptions: { args: ['--disable-gpu'] } })

const ROUTES = [
  '/', '/credits', '/login', '/register', '/clinician-register', '/admin-login', '/forgot-password', '/verify-otp',
  '/dashboard', '/training', '/tamil', '/tamil/practice/letter-ai', '/tamil/quiz/letter-ai', '/practice',
  '/assessment', '/evaluate', '/assessment/letters', '/letter-learning', '/videos',
  '/speech-analysis', '/tongue-tracking', '/games', '/games/vowels/vowel-catch',
  '/games/alphabet', '/progress', '/progress/lessons', '/reports',
  '/achievements', '/rewards', '/calendar', '/notifications', '/appointments',
  '/parent', '/therapist', '/profile', '/settings', '/help', '/feedback', '/about',
  '/play', '/play/settings', '/play/arcade/breath-balloon', '/play/quest/river-rescue',
  '/play/mouth-mirror', '/play/pippin', '/play/together', '/therapy/3', '/admin',
]
const AUTH_ROUTES = new Set(['/login', '/register', '/clinician-register', '/admin-login', '/forgot-password', '/verify-otp'])

const USER = {
  id: 'route-audit-admin',
  email: 'route-audit@example.invalid',
  full_name: 'Route Audit User',
  child_name: 'Kavi',
  child_age: 7,
  language: 'Tamil',
  role: 'admin',
  total_sessions: 12,
  total_stars: 180,
}

test('every application route renders without a broken image or redirect loop', async ({ page }) => {
  // One representative URL for each of the 48 declared route patterns.
  test.setTimeout(480_000)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    }
    if (path === '/api/therapy/lessons/3') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 3, symbol: 'ல', english: 'LA', phoneme: 'la', type: 'letter', difficulty: 2 }),
      })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"route audit backend unavailable"}' })
  })

  for (const route of ROUTES) {
    pageErrors.length = 0
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#root')).toContainText(/\S/)
    await expect(page.locator('.app-loading')).toHaveCount(0)
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    if (!AUTH_ROUTES.has(route)) await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
    const brokenImages = await page.locator('img').evaluateAll((images) => images
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.getAttribute('src')))
    expect(brokenImages, `broken images on ${route}`).toEqual([])
    expect(pageErrors, `uncaught errors on ${route}`).toEqual([])
  }
})

test('therapy route sends a therapist to the therapist workspace without loading the lesson', async ({ page }) => {
  let lessonRequests = 0
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...USER, role: 'therapist' }) })
    }
    if (path.startsWith('/api/therapy/lessons/')) lessonRequests += 1
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"route audit backend unavailable"}' })
  })

  await page.goto('/therapy/3')
  await expect(page).toHaveURL(/\/therapist$/)
  await expect(page.locator('.app-loading')).toHaveCount(0)
  expect(lessonRequests).toBe(0)
})

test('404 Go Back returns home on a direct visit without app history', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: '{"detail":"Not authenticated"}',
  }))

  await page.goto('/missing-page')
  await expect(page.getByText('Oops! This page seems to have wandered off.')).toBeVisible()
  await page.getByRole('button', { name: 'Go Back' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('main')).not.toBeEmpty()
})
