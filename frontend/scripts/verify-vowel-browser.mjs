import { tamilPair, tamilLength } from '../src/features/vowels/tamilLabels.js'
// Real browser microphone, local API, trained model and MongoDB integration.
// Chromium's fake-device flag supplies a held-out human WAV to the real recorder.
// No API responses, analysis, MediaRecorder or AudioContext are mocked.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.VOWEL_BROWSER_URL || 'http://127.0.0.1:5181'
const output = path.resolve('../.runlogs')
const report = { scope: 'Real browser recorder and local trained model/MongoDB; held-out human A supplied by Chromium, separate physical-mic test.', started_at: new Date().toISOString(), checks: [], results: [], page_errors: [] }
const check = (name, condition, evidence) => { report.checks.push({ name, passed: Boolean(condition), evidence }); assert.ok(condition, `${name}: ${JSON.stringify(evidence)}`) }
const input = path.join(output, 'vowel-browser-input.wav')
// Keep the human speech unchanged and add silence around it so Chromium's
// looping fake microphone cannot repeat it inside one seven-second capture.
fs.mkdirSync(output, { recursive: true })
const source = fs.readFileSync('../backend/models/vowel-classifier/heldout/a.wav')
assert.equal(source.toString('ascii', 8, 12), 'WAVE')
assert.equal(source.readUInt16LE(20), 1)
assert.equal(source.readUInt16LE(22), 1)
assert.equal(source.readUInt32LE(24), 16000)
assert.equal(source.readUInt16LE(34), 16)
assert.equal(source.toString('ascii', 36, 40), 'data')
const inputSamples = Buffer.concat([Buffer.alloc(32000), source.subarray(44), Buffer.alloc(256000)])
const header = Buffer.from(source.subarray(0, 44))
header.writeUInt32LE(36 + inputSamples.length, 4)
header.writeUInt32LE(inputSamples.length, 40)
fs.writeFileSync(input, Buffer.concat([header, inputSamples]))
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${input}`] })
try {
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, permissions: ['microphone'], reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.__qaTracks = []
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints)
      window.__qaTracks.push(...stream.getTracks())
      return stream
    }
  })
  const account = { email: `vowel-browser-${Date.now()}@example.com`, password: `QA!Voice${Date.now()}q9` }
  const registration = await context.request.post(base + '/api/auth/register', { data: { ...account, confirm_password: account.password, full_name: 'Browser QA Adult', child_name: 'QA Learner', child_age: 8, language: 'Tamil' } })
  check('Real account registration', registration.status() === 201, registration.status())
  const login = await context.request.post(base + '/api/auth/login', { data: account })
  check('Real cookie login', login.status() === 200, login.status())
  fs.writeFileSync(path.join(output, 'vowel-browser-account.log'), JSON.stringify(account))
  const page = await context.newPage()
  page.on('pageerror', error => report.page_errors.push(error.message))
  const assetsReady = async () => page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}) }))
  })
  const capture = async label => {
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/vowels/analyze') && response.request().method() === 'POST', { timeout: 45000 })
    const started = Date.now()
    await page.getByRole('button', { name: 'Start recording', exact: true }).click()
    await page.locator('.vowel-studio[data-state="RECORDING"]').waitFor()
    check(label + ': countdown starts at seven', /^7\.0|^6\./.test(await page.locator('.vowel-timer').innerText()))
    if (label === 'Practice') {
      await page.waitForTimeout(2200) // Capture actual voice; intentional recording duration.
      await page.screenshot({ path: path.join(output, 'vowel-live-recording.png'), fullPage: false })
    }
    const response = await responsePromise
    const envelope = await response.json()
    check(label + ': server response', response.status() === 200, response.status())
    const result = envelope.result
    report.results.push({ label, ...result })
    check(label + ': seven-second audio captured', result.audio_quality?.duration_seconds >= 6.6 && result.audio_quality.duration_seconds <= 7.6, result.audio_quality)
    check(label + ': one isolated vowel is scorable', result.scorable === true, result)
    check(label + ': actual A identity independent of target', result.vowel_analysis.identity === 'A', result.vowel_analysis)
    check(label + ': measured short vowel excludes silence', result.vowel_analysis.length === 'short' && result.vowel_analysis.duration_seconds < 1, result.vowel_analysis)
    check(label + ': recording did not end early', Date.now() - started >= 6800, Date.now() - started)
    await page.locator('.vowel-studio[data-state="RESULT"]').waitFor()
    check(label + ': microphone tracks released', await page.evaluate(() => window.__qaTracks.length > 0 && window.__qaTracks.every(track => track.readyState === 'ended')))
    return envelope
  }
  await page.goto(base + '/practice')
  await page.getByRole('button', { name: 'Start recording', exact: true }).waitFor({ timeout: 30000 })
  await assetsReady()
  await page.screenshot({ path: path.join(output, 'vowel-practice-desktop.png'), fullPage: false })
  const first = await capture('Practice')
  check('Practice target identity and length match', first.result.vowel_analysis.identity_match && first.result.vowel_analysis.length_match)
  await page.screenshot({ path: path.join(output, 'vowel-live-result-desktop.png'), fullPage: true })
  const before = await (await context.request.get(base + '/api/vowels/progress')).json()
  check('Practice saved exactly once', before.scored_attempts === 1, before.scored_attempts)
  await page.getByRole('button', { name: 'Finish practice' }).click()
  await page.getByText('SESSION COMPLETE', { exact: true }).waitFor()

  await page.goto(base + '/evaluate')
  const sessionPromise = page.waitForResponse(response => response.url().endsWith('/api/vowels/sessions') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Start evaluation', exact: true }).click()
  const session = await (await sessionPromise).json()
  check('Evaluation contains ten distinct vowel classes', new Set(session.challenges.map(item => item.target_phoneme)).size === 10)
  for (let index = 0; index < 10; index++) {
    await page.getByText(`Sound ${index + 1} of 10`, { exact: true }).waitFor()
    await capture(`Evaluation ${index + 1}`)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
  }
  await page.getByText('SESSION COMPLETE', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'vowel-live-evaluation-summary.png'), fullPage: true })
  const afterEvaluation = await (await context.request.get(base + '/api/vowels/progress')).json()
  check('All eleven acoustic attempts persist', afterEvaluation.scored_attempts === 11, afterEvaluation.scored_attempts)

  const listeningSessionPromise = page.waitForResponse(response => response.url().endsWith('/api/vowels/sessions') && response.request().method() === 'POST')
  await page.goto(base + '/games/vowels/match-sound')
  const listening = await (await listeningSessionPromise).json()
  for (let index = 0; index < 10; index++) {
    const challenge = listening.challenges[index]
    await page.getByRole('button', { name: 'Play reference sound', exact: true }).click()
    const choose = page.getByRole('button', { name: tamilPair(challenge.identity), exact: true })
    await choose.waitFor()
    await page.waitForFunction(() => !document.querySelector('.vowel-listening-game fieldset')?.disabled)
    await choose.click()
    await page.getByRole('button', { name: `${tamilLength(challenge.length)} / ${challenge.length}`, exact: true }).click()
    await page.getByRole('button', { name: 'Check my answer', exact: true }).click()
    await page.getByRole('heading', { name: 'You found its match.' }).waitFor()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
  }
  await page.getByText('SESSION COMPLETE', { exact: true }).waitFor()
  const afterListening = await (await context.request.get(base + '/api/vowels/progress')).json()
  check('Real reference listening answers persist separately', afterListening.listening.correct === 10 && afterListening.scored_attempts === 11, afterListening.listening)

  for (const [slug, route] of [['home', '/'], ['games', '/games'], ['evaluate', '/evaluate'], ['progress', '/progress'], ['training', '/training'], ['care', '/dashboard'], ['credits', '/credits']]) {
    await page.goto(base + route)
    await page.locator('h1,h2').first().waitFor({ timeout: 30000 })
    await assetsReady()
    await page.screenshot({ path: path.join(output, `vowel-${slug}-desktop.png`), fullPage: true })
    if (slug === 'home') await page.screenshot({ path: path.join(output, 'vowel-home-viewport.png'), fullPage: false })
    check(slug + ': desktop has no overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [slug, route] of [['home', '/'], ['practice', '/practice'], ['games', '/games'], ['evaluate', '/evaluate'], ['progress', '/progress']]) {
    await page.goto(base + route)
    await page.locator('h1,h2').first().waitFor({ timeout: 30000 })
    if (slug === 'practice') await page.getByRole('button', { name: 'Start recording', exact: true }).waitFor()
    await assetsReady()
    await page.screenshot({ path: path.join(output, `vowel-${slug}-mobile.png`), fullPage: true })
    check(slug + ': mobile has no overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  check('No browser JavaScript errors', report.page_errors.length === 0, report.page_errors)
  report.completed_at = new Date().toISOString()
  console.info(JSON.stringify({ passed: report.checks.length, acoustic_recordings: report.results.length, listening_answers: 10, page_errors: report.page_errors }))
} catch (error) {
  report.error = error.stack
  throw error
} finally {
  fs.writeFileSync(path.join(output, 'vowel-browser-integration.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
