// Real local API, MongoDB, ONNX inference and native browser recording.
// Synthetic reference input tests integration; it is not human accuracy data.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TAMIL_BROWSER_URL || 'http://127.0.0.1:5181'
const out = path.resolve('../.runlogs')
fs.mkdirSync(out, { recursive: true })
const report = { date: new Date().toISOString(), scope: 'Local real model/API/database and native MediaRecorder with synthesized Tamil input; not a human accuracy benchmark.', checks: [], results: [], page_errors: [] }
const check = (name, condition, evidence) => { report.checks.push({ name, passed: Boolean(condition), evidence }); assert.ok(condition, `${name}: ${JSON.stringify(evidence)}`) }
const source = fs.readFileSync('public/assets/tamil-reference/word-amma-valluvar.wav')
assert.equal(source.toString('ascii', 36, 40), 'data')
assert.equal(source.readUInt32LE(24), 16000)
// Leave setup time before the speech reaches the synthetic microphone.
const samples = Buffer.concat([Buffer.alloc(160000), source.subarray(44), Buffer.alloc(256000)])
const header = Buffer.from(source.subarray(0, 44))
header.writeUInt32LE(36 + samples.length, 4); header.writeUInt32LE(samples.length, 40)
const microphone = path.join(out, 'tamil-browser-input.wav')
fs.writeFileSync(microphone, Buffer.concat([header, samples]))
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${microphone}`] })
try {
  const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1536, height: 1024 }, reducedMotion: 'reduce' })
  const account = { email: `tamil-qa-${Date.now()}@example.com`, password: `TamilQA!${Date.now()}q9` }
  const reg = await context.request.post(base + '/api/auth/register', { data: { ...account, confirm_password: account.password, full_name: 'Tamil QA Adult', child_name: 'QA Learner', child_age: 8, language: 'Tamil' } })
  check('QA registration', reg.status() === 201, reg.status())
  check('Cookie login', (await context.request.post(base + '/api/auth/login', { data: account })).ok())
  fs.writeFileSync(path.join(out, 'tamil-qa-account.log'), JSON.stringify(account))
  const catalog = await (await context.request.get(base + '/api/tamil/catalog')).json()
  check('Catalog has26 lessons', catalog.items.length === 26)
  check('Twelve vowels in Tamil order', catalog.items.filter(item => item.kind === 'vowel').map(item => item.text).join(' ') === 'அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ')
  check('Eight words and six sentences', catalog.items.filter(item => item.kind === 'word').length === 8 && catalog.items.filter(item => item.kind === 'sentence').length === 6)
  for (const item of catalog.items) {
    const response = await context.request.get(base + (item.audio_url || `/api/vowels/reference/${item.studio_target}`))
    check(item.id + ': real reference WAV', response.ok() && (await response.body()).subarray(0, 4).toString() === 'RIFF', response.status())
  }
  const submit = (id, audio, request_id = randomUUID()) => context.request.post(base + '/api/tamil/evaluate', { multipart: { item_id: id, request_id, audio: { name: 'sample.wav', mimeType: 'audio/wav', buffer: audio } } })
  const key = randomUUID()
  const firstResponse = await submit('word-amma', source, key)
  check('Word audio scored by real API', firstResponse.ok(), firstResponse.status())
  const first = await firstResponse.json()
  check('Tamil word produces acoustic phones', first.result.scorable && first.result.actual_phonemes.length > 0, first.result)
  report.results.push(first.result)
  const repeated = await (await submit('word-amma', source, key)).json()
  check('Replay saves once', repeated.already_saved && repeated.progress.total_attempts === 1)
  check('Reusing ID for another item is rejected', (await submit('word-appa', source, key)).status() === 409)
  check('Unknown target rejected', (await submit('word-forged', source)).status() === 422)
  check('Measured vowel routed to dedicated engine', (await submit('letter-a', source)).status() === 422)
  const wrong = await (await submit('word-eli', source)).json()
  check('Prompt does not determine recognized phones', JSON.stringify(first.result.actual_phonemes) === JSON.stringify(wrong.result.actual_phonemes))
  check('Correct word matches better than different word', first.result.accuracy > wrong.result.accuracy, [first.result.accuracy, wrong.result.accuracy])
  const sentenceAudio = fs.readFileSync('public/assets/tamil-reference/sentence-idhu-maram.wav')
  const sentence = await (await submit('sentence-idhu-maram', sentenceAudio)).json()
  check('Sentence produces acoustic phones', sentence.result.scorable && sentence.result.actual_phonemes.length > 0, sentence.result)
  report.results.push(sentence.result)
  const before = await (await context.request.get(base + '/api/tamil/progress')).json()
  check('Word/sentence progress is separate', before.by_kind.word.attempts === 2 && before.by_kind.sentence.attempts === 1)
  const exported = await (await context.request.get(base + '/api/privacy/export')).json()
  check('Privacy export includes Tamil results', exported.tamil_attempts.length === 3)
  const page = await context.newPage()
  page.on('pageerror', error => report.page_errors.push(error.message))
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.__tamilTracks = []
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); window.__tamilTracks.push(...stream.getTracks()); return stream }
  })
  for (const [slug, url] of [['letters', '/tamil'], ['words', '/tamil?kind=word'], ['sentences', '/tamil?kind=sentence'], ['vowel', '/practice?target=uu']]) {
    await page.goto(base + url)
    await page.locator('h1').waitFor()
    await page.locator('.app-loading').waitFor({ state: 'detached' })
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}) })) })
    if (slug !== 'vowel') await page.locator('.tamil-learning-card').first().waitFor()
    check(slug + ': desktop fits', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: path.join(out, `tamil-${slug}-desktop.png`), fullPage: true })
  }
  await page.goto(base + '/tamil/practice/word-amma')
  await page.getByRole('button', { name: /Start recording/ }).waitFor()
  const player = page.getByRole('button', { name: /Listen in Tamil/ })
  await player.click()
  await page.getByRole('button', { name: /Stop example/ }).waitFor()
  check('Tamil example actually plays', true)
  await page.getByRole('button', { name: /Stop example/ }).click()
  for (const [id, label] of [['word-amma', 'word'], ['sentence-amma-vaa', 'sentence']]) {
    await page.goto(base + '/tamil/practice/' + id)
    const answer = page.waitForResponse(response => response.url().endsWith('/api/tamil/evaluate') && response.request().method() === 'POST', { timeout: 60000 })
    const started = Date.now()
    await page.getByRole('button', { name: /Start recording/ }).click()
    const response = await answer
    const data = await response.json()
    check(label + ': native seven-second capture', response.ok() && Date.now() - started >= 6800 && data.result.audio_quality.duration_seconds >= 6.5, data.result.audio_quality)
    check(label + ': browser upload scored', data.result.scorable, data.result)
    await page.locator('.tamil-result').waitFor()
    check(label + ': microphone released', await page.evaluate(() => window.__tamilTracks.every(track => track.readyState === 'ended')))
    report.results.push(data.result)
    await page.screenshot({ path: path.join(out, `tamil-${label}-result.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [slug, url] of [['letters', '/tamil'], ['words', '/tamil?kind=word'], ['sentences', '/tamil?kind=sentence'], ['practice', '/tamil/practice/sentence-idhu-maram'], ['vowel', '/practice?target=uu']]) {
    await page.goto(base + url)
    await page.locator('h1').waitFor()
    if (['letters', 'words', 'sentences'].includes(slug)) await page.locator('.tamil-learning-card').first().waitFor()
    check(slug + ': mobile fits', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: path.join(out, `tamil-${slug}-mobile.png`), fullPage: true })
  }
  check('Browser attempts persisted', (await (await context.request.get(base + '/api/tamil/progress')).json()).total_attempts === 5)
  check('No JavaScript errors', report.page_errors.length === 0, report.page_errors)
  console.log(JSON.stringify({ passed: report.checks.length, results: report.results.map(result => ({ item: result.item_id, score: result.accuracy })) }))
} finally {
  fs.writeFileSync(path.join(out, 'tamil-live-verification.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
