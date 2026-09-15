import { expect, test } from '@playwright/test'

test.use({ browserName: 'chromium', launchOptions: { args: ['--disable-gpu'] } })

async function mockSignedOut(page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: '{"detail":"Not authenticated"}',
  }))
}

test.beforeEach(async ({ page }) => {
  await mockSignedOut(page)
  await page.goto('/')
})

test('premium public header and account actions reach real destinations', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'FIND YOUR VOICE.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole('link', { name: 'Create one free', exact: true }).click()
  await expect(page).toHaveURL(/\/register$/)

  await page.goto('/login')
  await page.getByRole('link', { name: 'Create a clinician workspace', exact: true }).click()
  await expect(page).toHaveURL(/\/clinician-register$/)
})

test('voice attribution stays public on a direct signed-out visit', async ({ page }) => {
  await page.goto('/credits')
  await expect(page.getByRole('heading', { name: 'Human vowel examples' })).toBeVisible()
  await expect(page).toHaveURL(/\/credits$/)
  await expect(page.getByRole('link', { name: /Creative Commons Attribution/ })).toBeVisible()
})

test('a direct practice link restores its selected vowel after sign-in', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ json: {
    user: { id: 'direct-practice', role: 'user', full_name: 'Practice Tester', child_age: 8 },
    access_token: 'fixture-token',
  } }))
  await page.route('**/api/vowels/sessions', route => route.fulfill({ json: {
    id: 'direct-session', session_id: 'direct-session', mode: 'practice', status: 'active', next_index: 0,
    challenges: [{ index: 0, target_phoneme: 'uu', identity: 'U', length: 'long', symbol: 'ஊ' }],
  } }))
  await page.goto('/practice?target=uu')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email Address', { exact: true }).fill('practice@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill('Practice!123')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).toHaveURL(/\/practice\?target=uu$/)
  await expect(page.getByLabel('Choose your sound')).toHaveValue('uu')
  await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toBeVisible()
})

for (const item of [
  ['Learn Tamil', '/tamil'],
  ['Games', '/games'],
  ['Evaluate', '/evaluate'],
  ['Progress', '/progress'],
]) {
  test(`${item[0]} navigation links to its learning route and requests sign-in`, async ({ page }) => {
    const link = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: item[0], exact: true })
    await expect(link).toHaveAttribute('href', item[1])
    await link.click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible()
  })
}

test('hero discovery action reaches the complete vowel section', async ({ page }) => {
  await page.getByRole('link', { name: 'Meet the vowels', exact: true }).click()
  await expect(page).toHaveURL(/#meet-the-vowels$/)
  await expect(page.locator('#meet-the-vowels')).toBeInViewport()
  await expect(page.locator('#meet-the-vowels').getByRole('link', { name: /^Practice (short|long) [AEIOU]$/ })).toHaveCount(10)
})

test('mobile menu exposes its state, closes, and preserves navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const trigger = page.locator('button[aria-controls="voice-mobile-nav"]')
  await expect(trigger).toHaveAccessibleName('Open navigation')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(trigger).toHaveAccessibleName('Close navigation')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Games', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0)
})

test('public controls have names, usable targets, and no dead hash links', async ({ page }) => {
  const controls = page.locator('button:visible, a:visible')
  await expect(controls.first()).toBeVisible()

  const issues = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect()
    const name = element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('title') || ''
    const href = element.tagName === 'A' ? element.getAttribute('href') : null
    const problems = []
    if (!name) problems.push('missing accessible name')
    if (rect.height < 40) problems.push(`height ${Math.round(rect.height)}px`)
    if (href === '#') problems.push('dead hash link')
    return problems.length ? [`${name || '<unnamed>'}: ${problems.join(', ')}`] : []
  }))

  expect(issues).toEqual([])
})
