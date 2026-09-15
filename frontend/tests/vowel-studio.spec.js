import { expect, test } from '@playwright/test'

test.use({
  browserName: 'chromium',
  launchOptions: { args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
  reducedMotion: 'reduce',
})

const USER = { id: 'vowel-browser-test', role: 'user', full_name: 'Vowel Test Parent', child_name: 'Kavi', child_age: 7, email: 'vowel-test@example.invalid' }
const TARGETS = ['ee', 'a', 'uu', 'i', 'oo', 'e', 'aa', 'u', 'ii', 'o']
const SYMBOLS = { a: 'அ', aa: 'ஆ', e: 'எ', ee: 'ஏ', i: 'இ', ii: 'ஈ', o: 'ஒ', oo: 'ஓ', u: 'உ', uu: 'ஊ' }
const challenge = (target, index) => ({ index, target_phoneme: target, identity: target[0].toUpperCase(), length: target.length === 1 ? 'short' : 'long', symbol: SYMBOLS[target], audio: '/api/vowels/reference/test.wav', tip: 'Say one vowel comfortably.' })
const PROGRESS = {
  total_attempts: 4, scored_attempts: 3, average_score: 80, best_score: 91, current_streak: 3, longest_streak: 3,
  xp: 65, stars: 7, level: 'Explorer', mastered_classes: 1, total_classes: 10, completed_sessions: 2,
  badges: [{ id: 'three', label: 'Three sounds in a row' }],
  per_vowel: TARGETS.map((target, index) => ({ ...challenge(target, index), attempts: index === 0 ? 3 : 0, average_score: index === 0 ? 80 : null, best_score: index === 0 ? 91 : null, mastered: index === 0 })),
  recent_scores: [{ accuracy: 70, target_phoneme: 'ee', created_at: '2026-09-05T10:00:00Z' }, { accuracy: 79, target_phoneme: 'ee', created_at: '2026-09-05T10:01:00Z' }, { accuracy: 91, target_phoneme: 'ee', created_at: '2026-09-05T10:02:00Z' }],
}
const HISTORY = [{ id: 'saved-evaluation', mode: 'evaluate', status: 'completed', created_at: '2026-09-05T10:00:00Z', summary: { average_score: 87, challenge_count: 10 } }]

// Valid test audio, deliberately unrelated to classifier accuracy. The server
// fixtures test UI contracts; live acoustic model verification runs separately.
function referenceWav() {
  const rate = 8000
  const samples = 1600
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index += 1) wav.writeInt16LE(Math.round(Math.sin(index / rate * Math.PI * 440) * 4000), 44 + index * 2)
  return wav
}

function scoredResult(target, index, accuracy = 87) {
  const prompt = challenge(target, index)
  return {
    scorable: true, accuracy, challenge_index: index, target_phoneme: target, success: true,
    vowel_analysis: { identity: prompt.identity, length: prompt.length, duration_seconds: .42, confidence: .91, identity_confidence: .94, length_confidence: .91, identity_match: true, length_match: true },
    score_components: { identity: 40, duration: 30, pronunciation: 9, consistency: 8 },
    feedback: 'Your vowel and length matched the target.', stars_earned: 2, xp_earned: 20,
  }
}

async function mockStudio(page, { abstainFirst = false, wrongFirst = false } = {}) {
  const state = { sessions: [], uploads: [], answers: [], completed: [], results: [] }
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort())
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: USER })
    if (path === '/api/vowels/reference/test.wav') return route.fulfill({ contentType: 'audio/wav', body: referenceWav() })
    if (path === '/api/vowels/progress') return route.fulfill({ json: PROGRESS })
    if (path === '/api/vowels/sessions' && request.method() === 'GET') return route.fulfill({ json: { sessions: HISTORY } })
    if (path === '/api/vowels/sessions' && request.method() === 'POST') {
      const body = request.postDataJSON()
      const id = `fixture-session-${state.sessions.length + 1}`
      const session = { id, session_id: id, mode: body.mode, status: 'active', next_index: 0, challenges: (body.mode === 'practice' ? [body.target_phoneme] : TARGETS).map(challenge) }
      state.sessions.push(session)
      return route.fulfill({ json: session })
    }
    if (path === '/api/vowels/analyze') {
      const bytes = request.postDataBuffer()
      const content = bytes.toString('latin1')
      const field = name => content.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]+)`))?.[1]
      const target = field('target_phoneme')
      const index = Number(field('challenge_index'))
      expect(bytes.length).toBeGreaterThan(1000)
      expect(field('request_id')).toBeTruthy()
      const session = state.sessions.find(item => item.id === field('session_id'))
      expect(session.challenges[index].target_phoneme).toBe(target)
      state.uploads.push({ target, index, bytes: bytes.length })
      const result = abstainFirst && state.uploads.length === 1 ? { scorable: false, accuracy: null, validation_status: 'no_speech', feedback: 'No clear vowel was heard. Say one vowel naturally.' } : scoredResult(target, index)
      if (wrongFirst && state.uploads.length === 1) {
        Object.assign(result, { accuracy: 25, success: false, feedback: 'The detected vowel differs. Listen, then try again.', stars_earned: 0, xp_earned: 5 })
        Object.assign(result.vowel_analysis, { identity: 'U', length: 'short', identity_match: false, length_match: false })
      }
      if (result.scorable) state.results.push(result)
      return route.fulfill({ json: { result, progress: PROGRESS, session_id: session.id, next_index: result.scorable ? index + 1 : index } })
    }
    if (path.endsWith('/answer')) {
      const body = request.postDataJSON()
      state.answers.push(body)
      const prompt = challenge(TARGETS[body.challenge_index], body.challenge_index)
      const result = { kind: 'listening', scorable: false, accuracy: null, identity: body.identity, length: body.length, target_identity: prompt.identity, target_length: prompt.length, correct: body.identity === prompt.identity && body.length === prompt.length, feedback: 'Listen to the vowel and notice its length.' }
      state.results.push(result)
      return route.fulfill({ json: { result, next_index: body.challenge_index + 1, progress: PROGRESS } })
    }
    if (path.endsWith('/complete')) {
      state.completed.push(path)
      return route.fulfill({ json: { summary: { average_score: 87, best_score: 87, challenge_count: state.results.length, successful_challenges: state.results.length, component_averages: { identity: 40, duration: 30, pronunciation: 9, consistency: 8 }, strengths: ['ee', 'a'], weaknesses: ['oo'], recommendations: ['Practise long O again.'], results: state.results }, progress: PROGRESS } })
    }
    return route.fulfill({ status: 404, json: { detail: `Unexpected fixture endpoint: ${path}` } })
  })
  await page.addInitScript(() => {
    window.__captureEvidence = { starts: [], durations: [], streams: [] }
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await originalGetUserMedia(constraints)
      window.__captureEvidence.streams.push(stream)
      return stream
    }
    const NativeRecorder = window.MediaRecorder
    window.MediaRecorder = class ObservedRecorder extends NativeRecorder {
      start(...args) { this.startedAt = performance.now(); window.__captureEvidence.starts.push(this.startedAt); return super.start(...args) }
      stop() { window.__captureEvidence.durations.push(performance.now() - this.startedAt); return super.stop() }
    }
  })
  return state
}

async function record(page) {
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  await expect(page.locator('.vowel-studio')).toHaveAttribute('data-state', 'RECORDING')
  await expect(page.getByRole('button', { name: /Stop|Cancel analysis|Pause/ })).toHaveCount(0)
  await expect(page.locator('.vowel-studio')).toHaveAttribute('data-state', /RESULT|RETRY/, { timeout: 18000 })
}

test('practice records seven seconds, abstains without score, retries, and saves the measured result', async ({ page }) => {
  const fixture = await mockStudio(page, { abstainFirst: true })
  await page.goto('/practice?target=a')
  await record(page)
  expect(fixture.uploads).toHaveLength(1)
  await expect(page.locator('.vowel-result .vowel-feedback').filter({ hasText: 'No clear vowel was heard. Say one vowel naturally.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finish practice' })).toHaveCount(0)
  await expect(page.locator('.vowel-result-score')).toHaveCount(0)
  const timing = await page.evaluate(() => window.__captureEvidence.durations[0])
  expect(timing).toBeGreaterThanOrEqual(6900)
  expect(timing).toBeLessThan(8500)
  expect(await page.evaluate(() => window.__captureEvidence.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true)
  await page.getByRole('button', { name: 'Try again' }).click()
  await record(page)
  expect(fixture.uploads).toHaveLength(2)
  expect(fixture.uploads.map(item => item.index)).toEqual([0, 0])
  await expect(page.getByText('0.42 s', { exact: true })).toBeVisible()
  await expect(page.getByText('91%', { exact: true })).toBeVisible()
  await expect(page.locator('[aria-label="87 out of 100"]')).toBeVisible()
  await page.getByRole('button', { name: 'Finish practice' }).click()
  await expect(page.getByText('SESSION COMPLETE', { exact: true })).toBeVisible()
  expect(fixture.completed).toHaveLength(1)
})

for (const mode of ['vowel-catch', 'short-or-long', 'pippin-challenge', 'speed-round', 'vowel-tower', 'match-sound']) {
  test(`${mode} completes correct and incorrect rounds, restarts and exits cleanly`, async ({ page }) => {
    test.setTimeout(180000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const fixture = await mockStudio(page, { wrongFirst: true })
    await page.goto(`/games/vowels/${mode}`)
    for (let index = 0; index < 10; index++) {
      await expect(page.getByText(`Sound ${index + 1} of 10`, { exact: true })).toBeVisible()
      if (index === 0) expect(fixture.sessions).toHaveLength(1)
      if (mode === 'match-sound') {
        await page.getByRole('button', { name: 'Play reference sound' }).click()
        const identity = index === 0 ? 'U' : TARGETS[index][0].toUpperCase()
        const pairs = { A: 'அ / ஆ', E: 'எ / ஏ', I: 'இ / ஈ', O: 'ஒ / ஓ', U: 'உ / ஊ' }
        const length = TARGETS[index].length === 1 ? 'குறில் / short' : 'நெடில் / long'
        await page.getByRole('button', { name: pairs[identity], exact: true }).click()
        await page.getByRole('button', { name: length, exact: true }).click()
        await page.getByRole('button', { name: 'Check my answer' }).click()
        await expect(page.getByRole('heading', { name: index === 0 ? 'A new sound to explore.' : 'You found its match.' })).toBeVisible()
      } else {
        await record(page)
        await expect(page.getByRole('heading', { name: index === 0 ? 'You’re getting closer.' : 'You found your sound.' })).toBeVisible()
      }
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
    }
    await expect(page.getByText('SESSION COMPLETE', { exact: true })).toBeVisible()
    expect(fixture.completed).toHaveLength(1)
    expect(mode === 'match-sound' ? fixture.answers : fixture.uploads).toHaveLength(10)
    await page.getByRole('button', { name: 'Start a new session' }).click()
    await expect(page.getByText('Sound 1 of 10', { exact: true })).toBeVisible()
    expect(fixture.sessions).toHaveLength(2)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/games$/)
    expect(await page.evaluate(() => window.__captureEvidence.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true)
    expect(errors).toEqual([])
  })
}

test('permission denial explains how to retry without uploading audio', async ({ page }) => {
  const fixture = await mockStudio(page)
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied by test user', 'NotAllowedError') } })
  await page.goto('/practice')
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.locator('.vowel-studio')).toHaveAttribute('data-state', 'ERROR')
  await expect(page.getByRole('alert')).toContainText('Allow it in your browser settings')
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeEnabled()
  expect(fixture.uploads).toHaveLength(0)
})

test('recording has no stop control and leaving releases the microphone; pauses remain available between attempts', async ({ page }) => {
  const fixture = await mockStudio(page)
  await page.goto('/practice')
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.locator('.vowel-studio')).toHaveAttribute('data-state', 'RECORDING')
  await expect(page.getByRole('button', { name: /Stop|Pause|Cancel analysis/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.locator('.vowel-studio')).toHaveCount(0)
  expect(await page.evaluate(() => window.__captureEvidence.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true)
  await page.goto('/practice')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume session' })).toBeVisible()
  expect(await page.evaluate(() => window.__captureEvidence.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true)
  expect(fixture.uploads).toHaveLength(0)
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
})

for (const [mode, title, marker] of [
  ['vowel-catch', 'Vowel Catch', 'YOUR COLLECTION'],
  ['short-or-long', 'Short or Long?', 'Keep your vowel brief or hold it gently to match the length.'],
  ['pippin-challenge', 'Pippin Challenge', 'சொல்லுங்கள்: ஏ (நெடில்)!'],
  ['speed-round', 'Speed Round', 'Ten sounds. Take your time between recordings.'],
  ['vowel-tower', 'Vowel Tower', '0 levels built'],
]) {
  test(`${title} opens its own game flow and a server-generated challenge`, async ({ page }) => {
    const fixture = await mockStudio(page)
    await page.goto(`/games/vowels/${mode}`)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    // Pippin also exposes his message in the SVG's accessible description.
    // Assert the visible instruction, rather than selecting that hidden node.
    await expect(page.getByText(marker, { exact: false }).filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText('Sound 1 of 10', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
    expect(fixture.sessions.at(-1).mode).toBe(mode)
    expect(new Set(fixture.sessions.at(-1).challenges.map(item => item.target_phoneme)).size).toBe(10)
  })
}

test('Match the Sound plays a real test WAV, checks both choices, and advances without acoustic scores', async ({ page }) => {
  const fixture = await mockStudio(page)
  await page.goto('/games/vowels/match-sound')
  await expect(page.getByRole('heading', { name: 'Match the Sound' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start recording' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Check my answer' })).toBeDisabled()
  await page.getByRole('button', { name: 'Play reference sound' }).click()
  await expect(page.getByRole('button', { name: 'எ / ஏ', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'எ / ஏ', exact: true }).click()
  await page.getByRole('button', { name: 'நெடில் / long', exact: true }).click()
  await page.getByRole('button', { name: 'Check my answer' }).click()
  await expect(page.getByRole('heading', { name: 'You found its match.' })).toBeVisible()
  await expect(page.locator('.vowel-result-score')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  expect(fixture.answers[0]).toMatchObject({ identity: 'E', length: 'long', challenge_index: 0 })
  expect(fixture.uploads).toHaveLength(0)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Sound 2 of 10')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Check my answer' })).toBeDisabled()
})

test('evaluation completes ten distinct seven-second challenges and shows the saved summary', async ({ page }) => {
  test.setTimeout(150000)
  const fixture = await mockStudio(page)
  await page.goto('/evaluate')
  await page.getByRole('button', { name: 'Start evaluation' }).click()
  for (let index = 0; index < 10; index += 1) {
    await expect(page.getByText(`Sound ${index + 1} of 10`, { exact: true })).toBeVisible()
    await record(page)
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Continue' }).click()
  }
  expect(fixture.uploads.map(item => item.target)).toEqual(TARGETS)
  expect(fixture.uploads.map(item => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  expect(fixture.completed).toHaveLength(1)
  await expect(page.getByText('SESSION COMPLETE', { exact: true })).toBeVisible()
  await expect(page.locator('[aria-label="87 out of 100"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your strengths' })).toBeVisible()
  await expect(page.getByText('Practise long O again.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start a new session' }).click()
  await expect(page.getByText('Sound 1 of 10', { exact: true })).toBeVisible()
  expect(fixture.sessions.filter(session => session.mode === 'evaluate').length).toBeGreaterThanOrEqual(2)
})

test('progress renders only saved fixture data, exports it, and opens the selected practice target', async ({ page }) => {
  await mockStudio(page)
  await page.goto('/progress/vowels')
  await expect(page.getByRole('heading', { name: 'Your vowel map' })).toBeVisible()
  await expect(page.locator('.vowel-stat-row')).toContainText('80')
  await expect(page.locator('.vowel-stat-row')).toContainText('65')
  await expect(page.getByText('Three sounds in a row', { exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '87 / 100', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Recent scores in chronological order: 70, 79, 91' })).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export progress' }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('my-vowel-progress.json')
  const stream = await download.createReadStream()
  let json = ''
  for await (const chunk of stream) json += chunk.toString()
  expect(JSON.parse(json).progress).toMatchObject({ xp: 65, scored_attempts: 3, average_score: 80 })
  await page.getByRole('button', { name: 'Practice long E', exact: true }).click()
  await expect(page).toHaveURL(/\/practice\?target=ee$/)
  await expect(page.getByLabel('Choose your sound')).toHaveValue('ee')
})

test('practice remains usable at a narrow mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockStudio(page)
  await page.goto('/practice')
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Turn sound off' }).click()
  await expect(page.getByRole('button', { name: 'Listen to an example' })).toBeDisabled()
  await page.getByRole('button', { name: 'Turn sound on' }).click()
  await expect(page.getByRole('button', { name: 'Listen to an example' })).toBeEnabled()
})

test('audio credits distinguish the corrected Tamil word voice from sentence synthesis', async ({ page }) => {
  await mockStudio(page)
  await page.goto('/credits')

  await expect(page.getByRole('heading', { name: 'Tamil words and sentences' })).toBeVisible()
  await expect(page.getByText(/All ten word examples use Microsoft.*Valluvar/i)).toBeVisible()
  await expect(page.getByText(/The eight sentence examples use Meta AI/i)).toBeVisible()
})
