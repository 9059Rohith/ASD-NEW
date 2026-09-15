import path from 'node:path'
import { expect, test } from '@playwright/test'

test.use({ browserName: 'chromium', launchOptions: { args: ['--disable-gpu'] } })

const OUTPUT = path.resolve(process.cwd(), '..', 'docs', 'qa')

async function openPremiumHome(page, viewport) {
  await page.setViewportSize(viewport)
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Not authenticated"}' }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'FIND YOUR VOICE.' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window.scrollTo(0, 0))
}

test('capture premium public desktop implementation', async ({ page }) => {
  await openPremiumHome(page, { width: 1536, height: 1024 })
  await page.screenshot({ path: path.join(OUTPUT, 'premium-public-1536x1024.png') })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})

test('capture premium public mobile implementation', async ({ page }) => {
  await openPremiumHome(page, { width: 390, height: 844 })
  const criticalContent = page.locator('.voice-home-hero h1, .voice-hero-actions > *, .voice-home-copy > p')
  await expect(criticalContent).toHaveCount(4)
  const criticalContentFits = await criticalContent.evaluateAll((elements) => elements.every((element) => {
    const rect = element.getBoundingClientRect()
    return rect.left >= 0 && rect.right <= window.innerWidth
  }))
  expect(criticalContentFits).toBe(true)
  await page.screenshot({ path: path.join(OUTPUT, 'premium-public-390x844.png') })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})
