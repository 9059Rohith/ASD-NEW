// Selected licensed human fixtures -> native browser microphone -> real API/model.
// This is integration evidence, not an independent accuracy benchmark.
import { chromium, request } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const base = process.env.DIPHTHONG_BROWSER_URL || 'http://127.0.0.1:5182'
const folder = path.resolve('../.runlogs')
const report = { base, started: new Date().toISOString(), scope: 'Selected human fixtures through browser capture and actual model API', checks: [], cases: [] }
const check = (name, passed, evidence) => { report.checks.push({ name, passed: Boolean(passed), evidence }); assert.ok(passed, `${name}: ${JSON.stringify(evidence)}`) }
function readWav(name) {
  const file = fs.readFileSync(`../backend/models/diphthong-classifier/heldout/${name}.wav`)
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  let format, bits, rate, samples
  for (let offset = 12; offset + 8 <= file.length;) {
    const tag = file.toString('ascii', offset, offset + 4), size = view.getUint32(offset + 4, true)
    if (tag === 'fmt ') { format = view.getUint16(offset + 8, true); rate = view.getUint32(offset + 12, true); bits = view.getUint16(offset + 22, true) }
    if (tag === 'data') {
      samples = Float32Array.from({ length: size / (bits / 8) }, (_, i) => format === 3 ? view.getFloat32(offset + 8 + i * 4, true) : view.getInt16(offset + 8 + i * 2, true) / 32768)
      break
    }
    offset += 8 + size + size % 2
  }
  assert.equal(rate, 16000); assert.ok(samples?.length); return samples
}
function encodeFloat(samples) {
  const wav = Buffer.alloc(44 + samples.length * 4)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(3, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(64000, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(32, 34)
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 4, 40)
  samples.forEach((sample, i) => wav.writeFloatLE(sample, 44 + i * 4)); return wav
}
const cases = [
  { name: 'ai', source: 'ai', target: 'ai', matched: true },
  { name: 'au', source: 'au', target: 'au', matched: true },
  { name: 'quiet-au', source: 'au', target: 'au', gain: .01, matched: true },
  { name: 'wrong-au-prompt', source: 'ai', target: 'au', matched: false },
  { name: 'silence', source: 'ai', target: 'ai', gain: 0, rejected: true },
  { name: 'repeated-ai', source: 'ai', target: 'ai', repeat: true, rejected: true },
].filter(item => !process.env.DIPHTHONG_CASES || process.env.DIPHTHONG_CASES.split(',').includes(item.name))
const api = await request.newContext({ baseURL: base })
try {
  const account = { email: `diphthong-qa-${Date.now()}@example.com`, password: `VoiceQA!${Date.now()}x9` }
  check('Register isolated QA learner', (await api.post('/api/auth/register', { data: { ...account, confirm_password: account.password, full_name: 'Diphthong QA', child_name: 'QA Learner', child_age: 8, language: 'Tamil' } })).status() === 201)
  check('Login isolated QA learner', (await api.post('/api/auth/login', { data: account })).ok())
  const storageState = await api.storageState()
  for (const item of cases) {
    const original = readWav(item.source), samples = new Float32Array(12 * 16000)
    samples.set(original.map(x => x * (item.gain ?? 1)), 80000)
    if (item.repeat) samples.set(original, 80000 + original.length + 5000)
    const input = path.join(folder, `diphthong-input-${item.name}.wav`)
    fs.writeFileSync(input, encodeFloat(samples))
    const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${input}`] })
    try {
      const page = await browser.newPage({ storageState, reducedMotion: 'reduce' })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        window.__live = { streams: [], durations: [] }
        const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async args => { const stream = await get(args); window.__live.streams.push(stream); return stream }
        const Native = window.MediaRecorder
        window.MediaRecorder = class extends Native {
          start(...args) { this.began = performance.now(); return super.start(...args) }
          stop() { window.__live.durations.push(performance.now() - this.began); return super.stop() }
        }
      })
      await page.goto(`${base}/tamil/practice/letter-${item.target}`)
      const response = page.waitForResponse(r => r.url().endsWith('/api/tamil/evaluate') && r.request().method() === 'POST', { timeout: 60000 })
      await page.getByRole('button', { name: /Start recording/ }).click()
      await page.getByText('Recording finishes automatically', { exact: true }).waitFor({ timeout: 10000 })
      check(`${item.name}: no Stop control`, await page.getByRole('button', { name: /Stop recording|Discard|Cancel analysis/ }).count() === 0)
      const http = await response, body = await http.json(), result = body.result
      check(`${item.name}: real API succeeds`, http.ok(), body)
      await page.locator('.tamil-result').waitFor()
      check(`${item.name}: correct scorer provenance`, result.score_method === 'diphthong_identity_match_v1', result.score_method)
      if (item.rejected) check(`${item.name}: rejects without invented score`, result.scorable === false && result.accuracy === null, result)
      else {
        check(`${item.name}: independent detected identity`, result.detected_vowel === item.source.toUpperCase(), result)
        check(`${item.name}: match and confidence separated`, result.scorable && result.phoneme_match === item.matched && result.accuracy === (item.matched ? 100 : 0) && result.confidence >= .6 && result.confidence <= 1, result)
        check(`${item.name}: Tamil result displays detected vowel`, (await page.locator('.tamil-detected-vowel').innerText()).includes(item.source === 'ai' ? String.fromCodePoint(0xb90) : String.fromCodePoint(0xb94)))
      }
      const evidence = await page.evaluate(() => ({ durations: window.__live.durations, ended: window.__live.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')) }))
      check(`${item.name}: automatic seven-second capture`, evidence.durations.length === 1 && evidence.durations[0] >= 6900 && evidence.durations[0] < 9500, evidence)
      check(`${item.name}: microphone released`, evidence.ended)
      check(`${item.name}: no page errors`, errors.length === 0, errors)
      report.cases.push({ ...item, result, evidence })
      await page.screenshot({ path: path.join(folder, `diphthong-live-${item.name}.png`), fullPage: true })
      console.log(item.name, result.detected_vowel, result.confidence, result.validation_status)
    } finally { await browser.close() }
  }
} finally {
  await api.dispose()
  report.finished = new Date().toISOString()
  fs.writeFileSync(path.join(folder, 'diphthong-live-results.json'), JSON.stringify(report, null, 2))
}
