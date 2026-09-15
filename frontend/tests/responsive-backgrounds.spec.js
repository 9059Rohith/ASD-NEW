import { expect, test } from '@playwright/test'

test.use({ browserName: 'chromium', reducedMotion: 'reduce' })

test('floral backgrounds stay proportional and lesson pages fit resized windows', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/auth/me'
      ? { id: 'responsive-test-parent', role: 'user', full_name: 'Test Parent', child_name: 'Kavi', child_age: 7 }
      : path === '/api/tamil/catalog'
        ? { items: [{ id: 'letter-e', kind: 'vowel', text: 'எ', phoneme_target: 'e', length_label: 'kuril', transliteration: 'e', meaning: 'Tamil vowel', tip_ta: 'சொல்லுங்கள்.', tip: 'Say the vowel.', can_evaluate: true, audio_available_human: false }] }
      : { items: [], vowels: [], progress: {}, notes: [] } })
  })

  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 })
    for (const [path, ready, selector, image, pseudo] of [
      ['/tamil', '.tamil-learning-page', '.tamil-world', 'ivory-floral-content.png', true],
      ['/tamil/practice/letter-e', '.tamil-practice-page', '.tamil-world', 'ivory-floral-content.png', true],
      ['/practice', '.vowel-studio', '.voice-practice-page #voice-main', 'ivory-floral-content.png', false],
      ['/dashboard', '.care-world header', '.care-world main', 'ivory-floral-content.png', false],
    ]) {
      await page.goto(path)
      await expect(page.locator(ready)).toBeVisible()
      const surface = page.locator(selector)
      await expect(surface).toBeVisible()
      const styles = await surface.evaluate((element, usesPseudo) => {
        const css = getComputedStyle(element, usesPseudo ? '::before' : null)
        return { image: css.backgroundImage, size: css.backgroundSize, width: document.documentElement.scrollWidth }
      }, pseudo)
      expect(styles.image).toContain(image)
      expect(styles.size).toMatch(/min\(|auto 540px|cover/)
      expect(styles.width, `${path} overflows at ${width}px`).toBeLessThanOrEqual(width + 1)
      if (path === '/tamil/practice/letter-e') {
        await expect(page.locator('.tamil-practice-grid > .tamil-pippin-card .tamil-pippin')).toBeVisible()
      }
      if (path === '/practice') {
        await expect(page.locator('.vowel-choice-coach-frame .vowel-pippin')).toBeVisible()
        await expect(page.locator('.vowel-choice-coach-frame #vowel-target')).toBeVisible()
      }
    }
  }
})

test('sign-in artwork remains readable on a narrow screen', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { detail: 'Not signed in' } }))
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible()
  const background = await page.locator('.voice-auth').evaluate(element => getComputedStyle(element).backgroundImage)
  expect(background).toContain('ivory-floral-content.png')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})
