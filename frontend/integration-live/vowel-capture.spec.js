import path from 'node:path'
import { expect, test } from '@playwright/test'

// This real, single short-E recording is followed by silence. Chromium feeds
// it to the browser microphone; the app captures seven seconds and sends the
// actual PCM recording to the running API and database.
const clip = path.resolve('integration-live/quiet-short-e-once.wav')
test.use({
  permissions: ['microphone'],
  launchOptions: { args: [
    '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${clip}`,
  ] },
})

test('browser microphone accepts short E and rejects it for long EE', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/login')
  await page.getByRole('button', { name: 'Enter Demo' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/practice?target=ee')
  await expect(page.getByLabel('Choose your sound')).toHaveValue('ee')
  await expect(page.locator('.vowel-choice-coach-frame .vowel-pippin')).toBeVisible()

  const evaluated = page.waitForResponse(response => response.url().includes('/api/vowels/analyze') && response.request().method() === 'POST', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.locator('.vowel-studio')).toHaveAttribute('data-state', 'RECORDING')
  const response = await evaluated
  expect(response.status()).toBe(200)
  const body = await response.json()
  const result = body.result
  console.info('Live vowel capture:', JSON.stringify({ status: result.validation_status, duration: result.vowel_analysis?.duration_seconds, quality: result.audio_quality, accuracy: result.accuracy, success: result.success }))
  expect(result.target_phoneme).toBe('ee')
  expect(result.vowel_analysis?.duration_seconds).toBeLessThanOrEqual(1)
  expect(result.success).toBe(false)
  expect(result.accuracy ?? 0).toBeLessThanOrEqual(40)
  expect(result.stars_earned).toBe(0)
  await expect(page.locator('.vowel-studio')).toHaveAttribute('data-state', /RESULT|RETRY/)

  await page.goto('/practice?target=e')
  await expect(page.getByLabel('Choose your sound')).toHaveValue('e')
  const correctEvaluation = page.waitForResponse(reply => reply.url().includes('/api/vowels/analyze') && reply.request().method() === 'POST', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Start recording' }).click()
  const correctResponse = await correctEvaluation
  expect(correctResponse.status()).toBe(200)
  const correct = (await correctResponse.json()).result
  console.info('Live matching vowel:', JSON.stringify({ status: correct.validation_status, duration: correct.vowel_analysis?.duration_seconds, accuracy: correct.accuracy, success: correct.success }))
  expect(correct.vowel_analysis?.length).toBe('short')
  expect(correct.vowel_analysis?.identity).toBe('E')
  expect(correct.success).toBe(true)
  expect(correct.accuracy).toBeGreaterThan(70)
  await expect(page.locator('.vowel-studio')).toHaveAttribute('data-state', 'RESULT')
  expect(errors).toEqual([])
})
