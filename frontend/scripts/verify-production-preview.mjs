import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const base = 'http://127.0.0.1:5174'
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] })
const report = { checked_at: new Date().toISOString(), checks: [], errors: [] }
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, reducedMotion: 'reduce' })
  page.on('pageerror', error => report.errors.push(error.message))
  const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name) }
  await page.goto(base)
  await page.getByRole('heading', { name: /FIND.*YOUR.*VOICE/ }).waitFor()
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}) })) })
  check('Built homepage images load', await page.locator('img').evaluateAll(images => images.every(image => image.naturalWidth > 0)))
  check('Built homepage stays within viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check('Licensed fonts load locally', await page.evaluate(() => document.fonts.check('500 24px "Noto Sans Tamil"', 'தமிழ் ஐ ஔ') && Boolean(document.querySelector('link[href="/assets/fonts/fonts.css"]'))))
  check('Home exposes saved motion control', await page.getByRole('button', { name: 'Reduce motion', exact: true }).count() === 1)
  await page.screenshot({ path: '../.runlogs/vowel-production-home.png', fullPage: false })
  await page.goto(base + '/practice?target=uu')
  await page.getByLabel('Password', { exact: true }).waitFor()
  check('Protected practice opens login', new URL(page.url()).pathname === '/login')
  check('Login has named email control', await page.getByLabel('Email Address', { exact: true }).count() === 1)
  await page.goto(base + '/credits')
  await page.getByRole('heading', { name: 'Human vowel examples' }).waitFor()
  check('Built attribution route works', await page.getByRole('link', { name: /Creative Commons Attribution/ }).count() >= 1)
  await page.getByRole('heading', { name: /Tamil words and sentences/ }).waitFor()
  check('Tamil reference attribution is included', await page.locator('a[href="https://huggingface.co/facebook/mms-tts-tam"]').count() === 1)
  await page.goto(base + '/tamil/practice/word-amma')
  await page.getByLabel('Password', { exact: true }).waitFor()
  check('Tamil practice is protected', new URL(page.url()).pathname === '/login')
  check('Tamil destination survives login redirect', await page.evaluate(() => history.state?.usr?.from === '/tamil/practice/word-amma'))
  check('Built Tamil reference plays as a real asset', (await page.request.get(base + '/assets/tamil-reference/word-amma-valluvar.wav')).ok())
  check('New Tamil API is registered and protected', (await page.request.get('http://127.0.0.1:8000/api/tamil/catalog')).status() === 401)
  for (const route of ['/health/ready', '/health/vowels', '/health/speech']) {
    // Vite proxies /api only; health is verified directly against the local API.
    const apiResponse = await page.request.get('http://127.0.0.1:8000' + route)
    const health = await apiResponse.json()
    check(route + ' ready', apiResponse.ok() && health.status === 'ready')
    if (route === '/health/vowels') check('All twelve vowel engines ready', health.all_twelve_ready === true && health.diphthongs.status === 'ready')
  }
  await page.goto(base)
  await page.getByRole('button', { name: 'Try the full demo' }).click()
  await page.locator('.tamil-learning-page').waitFor()
  check('Home demo authenticates into real Tamil learning', new URL(page.url()).pathname === '/tamil')
  const catalog = await (await page.request.get(base + '/api/tamil/catalog')).json()
  check('Real demo curriculum contains all 26 lessons', catalog.items.length === 26)
  await page.goto(base + '/play/pippin')
  await page.getByTestId('pippin-story-svg').waitFor()
  check('Built Pippin has actual open and closed eye groups', await page.locator('.pippin-open-eyes,.pippin-closed-eyes').count() === 2)
  check('No JavaScript page errors', report.errors.length === 0)
  console.log(JSON.stringify({ passed: report.checks.length, errors: report.errors }))
} finally {
  fs.writeFileSync('../.runlogs/vowel-production-verification.json', JSON.stringify(report, null, 2))
  await browser.close()
}
