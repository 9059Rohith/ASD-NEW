// Real browser microphone/recorder/worklet -> local API/model -> MongoDB.
// Supplied human test clips exercise integration, not population accuracy.
import { chromium, request } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const base = process.env.QUIET_BROWSER_URL || 'http://127.0.0.1:5181'
const output = path.resolve('../.runlogs')
const report = { started: new Date().toISOString(), checks: [], results: [], errors: [] }
const check = (name, condition, evidence) => { report.checks.push({ name, passed: !!condition, evidence }); assert.ok(condition, `${name}: ${JSON.stringify(evidence)}`) }
const targets = ['a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ee', 'o', 'oo']
function readHuman(target) {
  const file = fs.readFileSync(`../backend/models/vowel-classifier/heldout/${target}.wav`)
  assert.equal(file.readUInt16LE(20), 1)
  assert.equal(file.readUInt32LE(24), 16000)
  assert.equal(file.toString('ascii', 36, 40), 'data')
  return Float32Array.from({ length: (file.length - 44) / 2 }, (_, i) => file.readInt16LE(44 + i * 2) / 32768)
}
function floatWav(samples, rate = 16000) {
  const file = Buffer.alloc(44 + samples.length * 4)
  file.write('RIFF'); file.writeUInt32LE(file.length - 8, 4); file.write('WAVEfmt ', 8)
  file.writeUInt32LE(16, 16); file.writeUInt16LE(3, 20); file.writeUInt16LE(1, 22)
  file.writeUInt32LE(rate, 24); file.writeUInt32LE(rate * 4, 28); file.writeUInt16LE(4, 32); file.writeUInt16LE(32, 34)
  file.write('data', 36); file.writeUInt32LE(samples.length * 4, 40)
  samples.forEach((sample, i) => file.writeFloatLE(sample, 44 + i * 4))
  return file
}
const selected = process.env.QUIET_CASES?.split(',')
const cases = [
  ...targets.map(target => ({ name: target, target, source: target, gain: 1, valid: true })),
  { name: 'quiet-a', target: 'a', source: 'a', gain: .01, valid: true },
  { name: 'quiet-uu', target: 'uu', source: 'uu', gain: .01, valid: true },
  { name: 'wrong-prompt', target: 'uu', source: 'a', gain: 1, valid: true },
  { name: 'silence', target: 'a', source: 'a', gain: 0, valid: false },
  { name: 'repeated', target: 'a', source: 'a', gain: 1, valid: false, repeat: true },
].filter(item => !selected || selected.includes(item.name))
const api = await request.newContext({ baseURL: base })
try {
  const account = { email: `quiet-qa-${Date.now()}@example.com`, password: `VoiceQA!${Date.now()}q9` }
  const registration = await api.post('/api/auth/register', { data: { ...account, confirm_password: account.password, full_name: 'Quiet Audio QA', child_name: 'QA Learner', child_age: 8, language: 'Tamil' } })
  check('Registration succeeds', registration.status() === 201, registration.status())
  check('Login succeeds', (await api.post('/api/auth/login', { data: account })).ok())
  const cookies = await api.storageState()
  for (const item of cases) {
    const original = readHuman(item.source)
    const samples = new Float32Array(12 * 16000)
    // Fake microphones stream during permission/worklet setup. Leave five
    // seconds so the utterance starts after the recording indicator is ready.
    samples.set(original.map(sample => sample * item.gain), 80000)
    if (item.repeat) samples.set(original, 80000 + original.length + 5000)
    const input = path.join(output, `quiet-input-${item.name}.wav`)
    fs.writeFileSync(input, floatWav(samples))
    const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${input}`] })
    try {
      const context = await browser.newContext({ storageState: cookies, permissions: ['microphone'], reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
      await context.addInitScript(() => {
        window.__quiet = { tracks: [], durations: [], uploads: [] }
        const send = XMLHttpRequest.prototype.send
        XMLHttpRequest.prototype.send = function(body) {
          const audio = body instanceof FormData ? body.get('audio') : null
          if (audio) {
            const entry = { name: audio.name, type: audio.type, size: audio.size }
            window.__quiet.uploads.push(entry)
            if (audio.type === 'audio/wav') audio.slice(0, 38).arrayBuffer().then(bytes => { entry.wavFormat = new DataView(bytes).getUint16(20, true) })
          }
          return send.call(this, body)
        }
        const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async options => { const stream = await getMedia(options); window.__quiet.tracks.push(...stream.getTracks()); return stream }
        const NativeRecorder = MediaRecorder
        window.MediaRecorder = class extends NativeRecorder {
          start(...args) { this.began = performance.now(); return super.start(...args) }
          stop() { window.__quiet.durations.push(performance.now() - this.began); return super.stop() }
        }
      })
      const page = await context.newPage()
      page.on('pageerror', error => report.errors.push(error.message))
      await page.goto(`${base}/practice?target=${item.target}`)
      await page.getByRole('button', { name: 'Start recording', exact: true }).waitFor()
      const responsePromise = page.waitForResponse(r => r.url().includes('/api/vowels/analyze') && r.request().method() === 'POST', { timeout: 45000 })
      // Preserve the original UI failure if an early assertion closes the page.
      responsePromise.catch(() => {})
      await page.getByRole('button', { name: 'Start recording', exact: true }).click()
      await page.locator('.vowel-studio[data-state="RECORDING"]').waitFor()
      check(`${item.name}: no Stop/Pause/Cancel button`, await page.getByRole('button', { name: /Stop|Pause|Cancel analysis/ }).count() === 0)
      const response = await responsePromise
      check(`${item.name}: analysis HTTP200`, response.ok(), response.status())
      const { result } = await response.json()
      const uploaded = await page.evaluate(() => window.__quiet.uploads.at(-1))
      report.results.push({ name: item.name, scorable: result.scorable, score: result.accuracy, status: result.validation_status, analysis: result.vowel_analysis, quality: result.audio_quality, uploaded })
      check(`${item.name}: expected scoring state`, result.scorable === item.valid, result.validation_status)
      const floatWav = uploaded?.name === 'vowel.wav' && uploaded?.type === 'audio/wav' && uploaded?.wavFormat === 3
      // Ordinary recordings may use the intentional native-codec fallback.
      // Recognition and timing assertions remain identical for either format.
      check(`${item.name}: supported capture format`, floatWav || (/^audio\/(webm|ogg|mp4)(;|$)/.test(uploaded?.type || '') && uploaded.size > 1000), uploaded)
      if (item.name.startsWith('quiet-')) check(`${item.name}: quiet samples preserved in float WAV`, floatWav, uploaded)
      if (item.valid) {
        const analysis = result.vowel_analysis
        check(`${item.name}: detects actual vowel`, analysis.identity === item.source[0].toUpperCase(), analysis)
        check(`${item.name}: detects actual short/long`, analysis.length === (item.source.length === 1 ? 'short' : 'long'), analysis)
        check(`${item.name}: voiced duration excludes silence`, analysis.duration_seconds > .07 && analysis.duration_seconds < original.length / 16000 + .12, analysis.duration_seconds)
        if (item.name === 'wrong-prompt') check('Wrong prompt is not rewarded as a match', analysis.identity_match === false && analysis.length_match === false && result.accuracy < 50, result.accuracy)
      } else check(`${item.name}: no fabricated score`, result.accuracy === null, result.accuracy)
      const evidence = await page.evaluate(() => ({ ended: window.__quiet.tracks.every(track => track.readyState === 'ended'), durations: window.__quiet.durations }))
      check(`${item.name}: native seven-second capture`, evidence.durations.length === 1 && evidence.durations[0] >= 6900 && evidence.durations[0] < 8000, evidence)
      check(`${item.name}: microphone released`, evidence.ended)
      if (['a', 'quiet-a', 'repeated'].includes(item.name)) await page.screenshot({ path: path.join(output, `quiet-result-${item.name}.png`), fullPage: true })
      console.log(JSON.stringify({ name: item.name, status: result.validation_status, score: result.accuracy, vowel: result.vowel_analysis?.identity, length: result.vowel_analysis?.length }))
    } finally { await browser.close() }
  }
  const progress = await (await api.get('/api/vowels/progress')).json()
  check('Lossless float capture exercised', report.results.some(item => item.uploaded?.wavFormat === 3))
  check('Every completed attempt persists once', progress.total_attempts === cases.length, progress)
  check('No application JavaScript errors', report.errors.length === 0, report.errors)
  console.log(JSON.stringify({ passed: report.checks.length, cases: cases.length }))
} finally {
  await api.dispose()
  fs.writeFileSync(path.join(output, selected ? 'quiet-live-smoke.json' : 'quiet-live-results.json'), JSON.stringify(report, null, 2))
}
