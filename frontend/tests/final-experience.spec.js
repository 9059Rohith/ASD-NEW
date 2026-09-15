import { expect, test } from '@playwright/test'

async function home(page, reducedMotion = 'no-preference') {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion })
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort())
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { detail: 'Not signed in' } }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'FIND YOUR VOICE.' })).toBeVisible()
  return errors
}

test('decorative parallax responds to pointer and scroll and stops for reduced motion', async ({ page }) => {
  const errors = await home(page)
  const hero = page.locator('.voice-home-hero')
  const box = await hero.boundingBox()
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .35)
  await expect.poll(() => hero.evaluate(el => parseFloat(el.style.getPropertyValue('--scene-x')))).toBeGreaterThan(3)
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }))
  await expect.poll(() => hero.evaluate(el => parseFloat(el.style.getPropertyValue('--scene-scroll')))).toBeGreaterThan(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(hero).toHaveAttribute('data-motion', 'reduced')
  expect(await hero.evaluate(el => el.style.getPropertyValue('--scene-x'))).toBe('')
  expect(await page.locator('.home-slide-scene>img').evaluate(el => getComputedStyle(el).translate)).toBe('none')
  await expect(page.getByRole('button', { name: 'Play slideshow' })).toBeVisible()
  expect(errors).toEqual([])
})

test('saved comfort control disables motion and leaves all learning content visible', async ({ page }) => {
  const errors = await home(page)
  await page.getByRole('button', { name: 'Reduce motion', exact: true }).click()
  await expect(page.locator('.voice-home-hero')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.getByRole('button', { name: 'Enable motion' })).toHaveAttribute('aria-pressed', 'true')
  for (const element of await page.locator('[data-home-reveal]').all()) {
    expect(await element.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  }
  await page.reload()
  await expect(page.locator('.voice-home-hero')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.getByRole('button', { name: 'Play slideshow' })).toBeVisible()
  expect(errors).toEqual([])
})

test('home demo retries a failed login and enters the real learning route once', async ({ page }) => {
  let attempts = 0
  let body
  await page.route('**/api/auth/login', async route => {
    attempts++
    body = route.request().postDataJSON()
    if (attempts === 1) return route.fulfill({ status: 503, json: { detail: 'Temporarily unavailable' } })
    return route.fulfill({ json: { access_token: 'fixture-token', user: { id: 'demo-fixture', full_name: 'Demo Parent', child_name: 'Kavi', child_age: 7, role: 'user', is_demo: true } } })
  })
  await page.route('**/api/tamil/**', route => route.fulfill({ json: { items: [], by_kind: {}, recent_attempts: [] } }))
  const errors = await home(page)
  await page.getByRole('button', { name: 'Try the full demo' }).click()
  await expect(page.getByRole('alert')).toContainText('demo could not open')
  await page.getByRole('button', { name: 'Try the full demo' }).click()
  await expect(page).toHaveURL(/\/tamil$/)
  expect(attempts).toBe(2)
  expect(body).toEqual({ email: 'demo@speakeasy.app', password: 'Demo@1234' })
  expect(errors).toEqual([])
})

test('leaving a pending demo does not redirect the next page', async ({ page }) => {
  let finishLogin
  const delayed = new Promise(resolve => { finishLogin = resolve })
  let requested
  const requestStarted = new Promise(resolve => { requested = resolve })
  await page.route('**/api/auth/login', async route => {
    requested()
    await delayed
    await route.fulfill({ json: { user: { id: 'late-demo', role: 'user', full_name: 'Demo Parent' } } }).catch(() => {})
  })
  await home(page)
  await page.getByRole('button', { name: 'Try the full demo' }).click()
  await requestStarted
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  finishLogin()
  await expect(page.getByRole('button', { name: 'Enter Demo' })).toBeVisible()
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/login$/)
})

test('Pippin visibly closes his eyes and pauses all motion when hidden or reduced', async ({ page }) => {
  await page.clock.install()
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort())
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'pippin-motion', role: 'user', full_name: 'Test Parent' } }))
  await page.goto('/play/pippin')
  const scene = page.getByTestId('pippin-storybook')
  await expect(scene).toBeVisible()
  // Browser compositor transitions use real time; freeze only interpolation
  // while the real blink controller runs on Playwright's virtual timer.
  await page.addStyleTag({ content: '.pippin-open-eyes,.pippin-closed-eyes{transition:none!important}' })
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  // Real randomized timer is bounded; step until the actual blink fires.
  const eyes = page.getByTestId('pippin-eyes')
  let closed = false
  for (let tick = 0; tick < 140; tick++) {
    await page.clock.runFor(50)
    if (await eyes.getAttribute('data-blink') === 'closed') { closed = true; break }
  }
  expect(closed).toBe(true)
  expect(await eyes.locator('.pippin-open-eyes').evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.2)
  expect(await eyes.locator('.pippin-closed-eyes').evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.8)
  await page.clock.runFor(400)
  await expect(eyes).toHaveAttribute('data-blink', 'open')
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(scene).toHaveAttribute('data-animation-paused', 'true')
  expect(await scene.locator('.pippin-tail').evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused')
  await page.clock.runFor(20000)
  await expect(eyes).toHaveAttribute('data-blink', 'open')
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(scene).toHaveAttribute('data-motion', 'minimal')
  await page.clock.runFor(20000)
  await expect(eyes).toHaveAttribute('data-blink', 'open')
})

for (const width of [360, 768, 1440]) test(`local Tamil fonts and complete home fit ${width}px`, async ({ page }) => {
  const remoteFonts = []
  page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) remoteFonts.push(request.url()) })
  await page.setViewportSize({ width, height: 1000 })
  const errors = await home(page, 'reduce')
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('500 24px "Noto Sans Tamil"', 'ஐ ஔ தமிழ்'))).toBe(true)
  expect(remoteFonts).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: `C:/final_year_project/.runlogs/final-home-${width}.png`, fullPage: true })
  expect(errors).toEqual([])
})
