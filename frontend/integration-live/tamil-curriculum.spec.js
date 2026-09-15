import { expect, test } from '@playwright/test'

test('live Tamil catalog, listening, construction, ordering, writing, and saved progress', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  await page.goto('/login')
  await page.getByRole('button', { name: 'Enter Demo' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  const catalogResponse = await page.request.get('/api/tamil/catalog')
  expect(catalogResponse.status()).toBe(200)
  const items = (await catalogResponse.json()).items
  expect(items).toHaveLength(263)
  expect(new Set(items.map(item => item.id)).size).toBe(263)
  expect(items.filter(item => item.kind === 'vowel' && item.audio_url)).toHaveLength(12)

  const beforeResponse = await page.request.get('/api/tamil/progress')
  expect(beforeResponse.status()).toBe(200)
  const beforeProgress = await beforeResponse.json()
  const before = beforeProgress.recognition_by_item?.['word-amma']?.attempts ?? 0
  const beforeCombined = beforeProgress.recognition_by_item?.['uyirmei-ka-aa']?.attempts ?? 0
  const beforeSentence = beforeProgress.recognition_by_item?.['sentence-amma-veettil']?.attempts ?? 0

  await page.goto('/tamil/quiz/word-amma')
  await page.getByRole('button', { name: 'Listen and choose' }).click()
  await expect(page.locator('audio.tamil-quiz-audio')).toBeVisible()
  await page.locator('audio.tamil-quiz-audio').evaluate(async audio => { await audio.play(); audio.pause() })
  const answer = page.waitForResponse(response => response.url().endsWith('/api/tamil/answer') && response.request().method() === 'POST')
  await page.locator('.tamil-quiz-choice').filter({ hasText: 'அம்மா' }).click()
  const saved = await answer
  expect(saved.status()).toBe(200)
  expect((await saved.json()).result.correct).toBe(true)
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')

  await page.goto('/tamil/quiz/uyirmei-ka-aa')
  await page.getByRole('button', { name: 'Build letter' }).click()
  await page.getByRole('combobox', { name: /Consonant/ }).selectOption('consonant-ka')
  await page.getByRole('combobox', { name: /Vowel/ }).selectOption('letter-aa')
  await page.getByRole('button', { name: 'Check letter' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')

  await page.goto('/tamil/quiz/sentence-amma-veettil')
  await page.getByRole('button', { name: 'Arrange words' }).click()
  const bank = page.locator('.tamil-quiz-word-row[aria-label="Available words"]')
  for (const word of 'அம்மா வீட்டில் இருக்கிறார்.'.split(' ')) await bank.getByRole('button', { name: word, exact: true }).click()
  await page.getByRole('button', { name: 'Check order' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')

  await page.goto('/tamil/quiz/word-amma')
  await page.getByRole('button', { name: 'Type Tamil' }).click()
  await page.getByLabel('Your Tamil answer').fill('அம்மா')
  const writingResponse = page.waitForResponse(response => response.url().endsWith('/api/tamil/answer') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Check writing' }).click()
  const writing = await writingResponse
  expect(writing.status()).toBe(200)
  expect((await writing.json()).result).toMatchObject({ correct: true, score_method: 'catalog_exercise_v1' })
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')

  const after = await (await page.request.get('/api/tamil/progress')).json()
  expect(after.recognition_by_item['word-amma'].attempts).toBe(before + 2)
  expect(after.recognition_by_item['uyirmei-ka-aa'].attempts).toBe(beforeCombined + 1)
  expect(after.recognition_by_item['sentence-amma-veettil'].attempts).toBe(beforeSentence + 1)
  expect(after.review_by_item['uyirmei-ka-aa'].interval_days).toBeGreaterThan(0)
  await page.reload()
  await expect(page.locator('.tamil-quiz-feedback')).toHaveCount(0)
  await page.goto('/tamil?kind=word')
  await expect(page.locator('.tamil-mastery-note')).toContainText('Recognition mastery')
  expect(errors).toEqual([])
})
