import { expect, test } from '@playwright/test'

test.use({ browserName: 'chromium', launchOptions: { args: ['--disable-gpu'] } })

const USER = {
  id: 'page-audit-user',
  email: 'page-audit@example.invalid',
  full_name: 'Page Audit Parent',
  child_name: 'Kavi',
  child_age: 7,
  language: 'Tamil',
  role: 'user',
  total_sessions: 12,
  total_stars: 180,
}

const LESSON = {
  id: 3,
  symbol: 'ல',
  english: 'LA',
  phoneme: 'la',
  type: 'letter',
  difficulty: 2,
  image: '/assets/letters/la.png',
}

async function mockPrivateApi(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    }
    if (path === '/api/therapy/lessons/3') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LESSON) })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"audit backend unavailable"}' })
  })
}

test('forgot password enters the reset flow instead of changing the URL hash', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: '{"detail":"Not authenticated"}',
  }))

  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()

  await expect(page).toHaveURL(/\/forgot-password$/)
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible()
})

test('therapy uses built-in visuals and never renders a broken lesson image', async ({ page }) => {
  await mockPrivateApi(page)
  await page.goto('/therapy/3')
  await expect(page.getByText('LA', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

  const brokenImages = await page.locator('img').evaluateAll((images) => images
    .filter((image) => image.complete && image.naturalWidth === 0)
    .map((image) => image.getAttribute('src')))
  expect(brokenImages).toEqual([])
})

test('therapy loads the next slide after entering the lesson', async ({ page }) => {
  await mockPrivateApi(page)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('/therapy/3')
  await expect(page.getByTestId('letter-picture-layout')).toBeVisible()
  await page.getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByText('Watch & Learn Pronunciation!')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('training videos expose a real local player', async ({ page }) => {
  await mockPrivateApi(page)
  await page.goto('/videos')

  const player = page.getByTestId('pronunciation-video')
  await expect(player).toBeVisible()
  await expect(player).toHaveAttribute('controls', '')
  await expect(player).toHaveAttribute('src', /pronounciation_a.*\.mp4/)
})

test('letter learning Play Sound invokes local speech synthesis', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spokenLetters = []
    class MockUtterance { constructor(text) { this.text = text } }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        getVoices: () => [{ name: 'Tamil Test Voice', lang: 'ta-IN', localService: true }],
        speak(utterance) {
          window.__spokenLetters.push({ text: utterance.text, lang: utterance.lang })
          utterance.onstart?.()
          utterance.onend?.()
        },
      },
    })
  })
  await mockPrivateApi(page)
  await page.goto('/letter-learning')
  await page.getByRole('button', { name: 'Play Sound' }).click()

  await expect.poll(() => page.evaluate(() => window.__spokenLetters)).toEqual([
    { text: 'அ', lang: 'ta-IN' },
  ])
})

test('Game Hub Play opens a real playable destination', async ({ page }) => {
  await mockPrivateApi(page)
  await page.goto('/games/alphabet')
  await page.getByRole('button', { name: 'Play Alphabet Match' }).click()

  await expect(page).toHaveURL(/\/games\/alphabet#alphabet-match$/)
  await expect(page.getByTestId('alphabet-match-game')).toBeFocused()
})

test('Settings help cards navigate to working support pages', async ({ page }) => {
  await mockPrivateApi(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: /How to Use ASD-Edge-ST/ }).click()

  await expect(page).toHaveURL(/\/help$/)
  await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible()
})

test('legacy lesson pages use the same sixteen targets as the therapy API', async ({ page }) => {
  const pazham = '\u0baa\u0bb4\u0bae\u0bcd'
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    }
    if (path.startsWith('/api/progress/summary/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        total_lessons: 16,
        completed_lessons: 0,
        progress_by_lesson: [{ lesson_id: 16, phoneme: 'pazham', best_accuracy: 54, attempts: 1 }],
        chart_data: [],
      }) })
    }
    if (path === '/api/therapy/lessons/16') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 16, symbol: pazham, english: 'PAZHAM', phoneme: 'pazham', type: 'word', difficulty: 3,
      }) })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"audit backend unavailable"}' })
  })

  await page.goto('/letter-learning')
  await expect(page.getByText('Vowel 1 of 12')).toBeVisible()
  await expect(page.getByText('Vowel Strip')).toBeVisible()

  await page.goto('/progress/lessons')
  await expect(page.getByText('0/16')).toBeVisible()
  await expect(page.getByText('PAZHAM', { exact: true })).toBeVisible()
  await expect(page.getByText('NAAI', { exact: true })).toHaveCount(0)

  await page.goto('/dashboard')
  await page.getByRole('button', { name: `Practise ${pazham}, 54 percent accuracy` }).click()
  await expect(page).toHaveURL(/\/therapy\/16$/)
})

test('legacy learning and progress pages fit a narrow mobile viewport', async ({ page }) => {
  await mockPrivateApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ['/letter-learning', '/progress/lessons', '/dashboard']) {
    await page.goto(route)
    await expect(page.locator('h1').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${route} should not scroll horizontally`).toBeLessThanOrEqual(1)
  }
})

test('therapist support pages return directly to the therapist workspace', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...USER, role: 'therapist' }) })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"audit backend unavailable"}' })
  })

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Back to workspace' }).click()
  await expect(page).toHaveURL(/\/therapist$/)

  await page.goto('/about')
  await page.getByRole('button', { name: /Go to Therapist Workspace/ }).click()
  await expect(page).toHaveURL(/\/therapist$/)

  await page.goto('/admin-login')
  await expect(page).toHaveURL(/\/therapist$/)
})

test('Help quick actions and articles reveal real content', async ({ page }) => {
  await mockPrivateApi(page)
  await page.goto('/help')
  await page.getByRole('button', { name: /Video Tutorials/ }).click()
  await expect(page).toHaveURL(/\/videos$/)

  await page.goto('/help')
  const article = page.getByRole('button', { name: /Setting up camera & microphone permissions/ })
  await article.click()
  await expect(article).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText(/open the lock icon beside the address/)).toBeVisible()
})

test('Tongue Tracking requests a real private camera stream and releases it', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cameraRequests = 0
    window.__cameraStops = 0
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          window.__cameraRequests += 1
          return { getTracks: () => [{ stop: () => { window.__cameraStops += 1 } }] }
        },
      },
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, writable: true, value: null })
    HTMLMediaElement.prototype.play = async () => {}
  })
  await mockPrivateApi(page)
  await page.goto('/tongue-tracking')
  await page.getByRole('button', { name: 'Start Camera' }).click()

  await expect(page.getByTestId('tongue-camera')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__cameraRequests)).toBe(1)
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect.poll(() => page.evaluate(() => window.__cameraStops)).toBe(1)
})

test('Reports Save as PDF opens the browser print dialog', async ({ page }) => {
  await page.addInitScript(() => {
    window.__printCalls = 0
    window.print = () => { window.__printCalls += 1 }
  })
  await mockPrivateApi(page)
  await page.goto('/reports')
  await page.getByRole('button', { name: /Download PDF|Save as PDF/ }).click()

  await expect.poll(() => page.evaluate(() => window.__printCalls)).toBe(1)
})

test('Profile avatar and security controls perform real actions', async ({ page }) => {
  await mockPrivateApi(page)
  await page.goto('/profile')
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('small-avatar'),
  })
  await expect(page.getByTestId('profile-avatar-preview')).toBeVisible()

  await page.getByRole('button', { name: 'Change Password' }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('Profile edits are sent to the profile API', async ({ page }) => {
  let update
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    }
    if (path === '/api/profile/personal') {
      update = route.request().postDataJSON()
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(update) })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"audit backend unavailable"}' })
  })

  await page.goto('/profile')
  await page.getByRole('button', { name: 'Edit Profile' }).click()
  await page.getByLabel('Full Name').fill('Updated Parent')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect.poll(() => update).toMatchObject({ full_name: 'Updated Parent' })
})

test('Appointments reschedule persists and displays server notes', async ({ page }) => {
  const originalDate = new Date(Date.now() + 7 * 86_400_000)
  const rescheduledDate = new Date(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate() + 1, 14, 15)
  const dateValue = `${rescheduledDate.getFullYear()}-${String(rescheduledDate.getMonth() + 1).padStart(2, '0')}-${String(rescheduledDate.getDate()).padStart(2, '0')}`
  const upcoming = { id: 'session-1', therapist_id: 'therapist-1', therapist_name: 'Dr. Mira', scheduled_at: originalDate.toISOString(), duration_min: 30, mode: 'online', status: 'confirmed' }
  const past = { id: 'past-1', therapist_name: 'Dr. Mira', scheduled_at: new Date(Date.now() - 86_400_000).toISOString(), status: 'completed', note: 'Practised clear initial sounds.' }
  let reschedulePayload
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    if (path === '/api/appointments/available-therapists') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'therapist-1', full_name: 'Dr. Mira' }]) })
    if (path === '/api/appointments') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: route.request().url().includes('upcoming=true') ? [upcoming] : [past, upcoming], total: 2, page: 1, pages: 1 }) })
    if (path === '/api/appointments/session-1/reschedule') {
      reschedulePayload = route.request().postDataJSON()
      upcoming.scheduled_at = reschedulePayload.scheduled_at
      upcoming.status = 'pending'
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(upcoming) })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"unavailable"}' })
  })

  await page.goto('/appointments')
  await page.getByTitle('Reschedule').click()
  await expect(page.getByRole('heading', { name: 'Reschedule Appointment' })).toBeVisible()
  await page.getByLabel('Date').fill(dateValue)
  await page.getByLabel('Time').fill('14:15')
  await page.getByRole('button', { name: 'Save New Time' }).click()
  await expect.poll(() => reschedulePayload).toMatchObject({ duration_min: 30, scheduled_at: rescheduledDate.toISOString() })
  await page.getByRole('button', { name: 'View notes' }).click()
  await expect(page.getByText('Practised clear initial sounds.')).toBeVisible()
})

test('Parent workspace shows real care data without fabricated invoices', async ({ page }) => {
  await mockPrivateApi(page)
  await page.goto('/parent')
  await expect(page.getByRole('button', { name: 'Download Invoices' })).toHaveCount(0)
  await expect(page.getByText('Monthly Therapy Plan')).toHaveCount(0)
  await expect(page.locator('#care-dashboard-title')).toBeVisible()
})

test('public and registration pages contain no dead hash links', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: '{"detail":"Not authenticated"}',
  }))
  await page.goto('/')
  await expect(page.locator('footer')).toBeVisible()
  await expect(page.locator('a[href="#"]')).toHaveCount(0)

  await page.goto('/register')
  await page.getByLabel('Parent / Guardian Name').fill('Test Parent')
  await page.getByLabel("Child's Name").fill('Maya')
  await page.getByLabel("Child's Age").fill('7')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/about#terms')
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/about#privacy')
})

test('password reset calls the API through request, OTP, and new password', async ({ page }) => {
  const calls = []
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Not authenticated"}' })
    }
    calls.push({ path, body: route.request().postDataJSON() })
    if (path === '/api/auth/verify-otp') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"valid":true}' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"ok"}' })
  })

  await page.goto('/forgot-password')
  await page.getByLabel('Email Address').fill('parent@example.com')
  await page.getByRole('button', { name: 'Send Reset Code' }).click()
  await expect.poll(() => calls[0]).toEqual({
    path: '/api/auth/forgot-password',
    body: { email: 'parent@example.com' },
  })
  await page.getByRole('button', { name: 'Enter Reset Code' }).click()

  const otpInputs = page.locator('input[inputmode="numeric"]')
  for (let index = 0; index < 6; index += 1) await otpInputs.nth(index).fill(String(index + 1))
  await page.getByRole('button', { name: 'Verify Code' }).click()
  await expect(page.getByLabel('New Password', { exact: true })).toBeVisible()
  await page.getByLabel('New Password', { exact: true }).fill('NewSafePassword1!')
  await page.getByLabel('Confirm New Password').fill('NewSafePassword1!')
  await page.getByRole('button', { name: 'Reset Password' }).click()

  await expect(page).toHaveURL(/\/login$/)
  expect(calls).toEqual([
    { path: '/api/auth/forgot-password', body: { email: 'parent@example.com' } },
    { path: '/api/auth/verify-otp', body: { email: 'parent@example.com', otp: '123456' } },
    { path: '/api/auth/reset-password', body: { email: 'parent@example.com', otp: '123456', new_password: 'NewSafePassword1!' } },
  ])
})
