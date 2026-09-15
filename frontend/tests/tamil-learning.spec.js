import { expect, test } from '@playwright/test'

test.use({ browserName: 'chromium', permissions: ['microphone'], reducedMotion: 'reduce', launchOptions: { args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } })

const VOWELS = [['a', 'அ'], ['aa', 'ஆ'], ['i', 'இ'], ['ii', 'ஈ'], ['u', 'உ'], ['uu', 'ஊ'], ['e', 'எ'], ['ee', 'ஏ'], ['ai', 'ஐ'], ['o', 'ஒ'], ['oo', 'ஓ'], ['au', 'ஔ']]
const CONSONANTS = [['ka', 'க்'], ['nga', 'ங்'], ['ca', 'ச்'], ['nya', 'ஞ்'], ['tta', 'ட்'], ['nna', 'ண்'], ['ta', 'த்'], ['na', 'ந்'], ['pa', 'ப்'], ['ma', 'ம்'], ['ya', 'ய்'], ['ra', 'ர்'], ['la', 'ல்'], ['va', 'வ்'], ['zha', 'ழ்'], ['lla', 'ள்'], ['rra', 'ற்'], ['nnna', 'ன்']]
const VOWEL_SIGNS = ['', 'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ']
const WORDS = [['amma', 'அம்மா', 'Mother'], ['appa', 'அப்பா', 'Father'], ['maram', 'மரம்', 'Tree'], ['naai', 'நாய்', 'Dog']]
const SENTENCES = [['amma-veettil', 'அம்மா வீட்டில் இருக்கிறார்.', 'Mother is at home.'], ['naai-odugiradhu', 'நாய் ஓடுகிறது.', 'The dog is running.']]
const phrase = (kind, [id, text, meaning]) => ({ id: `${kind}-${id}`, kind, text, meaning, transliteration: id.replaceAll('-', ' '), tip_ta: 'மெதுவாகச் சொல்லிப் பழகலாம்.', tip: 'Say this example once naturally.', phoneme_target: id.replaceAll('-', '_'), audio_url: `/assets/tamil-reference/${kind}-${id}${kind === 'word' ? '-valluvar' : ''}.wav`, audio_kind: 'synthetic_tamil', audio_available_human: false })
const ROMAN = { a: 'a', aa: 'aa', i: 'i', ii: 'ee', u: 'u', uu: 'oo', e: 'e', ee: 'ē', ai: 'ai', o: 'o', oo: 'ō', au: 'au' }
const CATALOG = [
  ...VOWELS.map(([target, text]) => ({ id: `letter-${target}`, kind: 'vowel', text, meaning: 'Tamil vowel', transliteration: ROMAN[target], tip_ta: 'ஒலியைக் கேட்டுப் பழகலாம்.', tip: 'Say the vowel naturally.', phoneme_target: target, length_label: ['a', 'i', 'u', 'e', 'o'].includes(target) ? 'kuril' : 'nedil', studio_target: ['ai', 'au'].includes(target) ? undefined : target, ...(['ai', 'au'].includes(target) ? { audio_url: `/assets/tamil-reference/letter-${target}.wav`, audio_kind: 'human_tamil' } : {}) })),
  ...CONSONANTS.map(([target, text]) => ({ id: `consonant-${target}`, kind: 'consonant', text, transliteration: target, tip_ta: 'எழுத்தைப் பழகலாம்.', tip: 'Study this letter.', can_evaluate: false })),
  { id: 'aytham-symbol', kind: 'aytham', text: 'ஃ', transliteration: 'āytam', tip_ta: 'ஆய்த எழுத்தைப் பழகலாம்.', tip: 'Recognize and write the symbol.', can_evaluate: false },
  ...CONSONANTS.flatMap(([target, mei]) => VOWELS.map(([vowel], index) => ({ id: `uyirmei-${target}-${vowel}`, kind: 'uyirmei', text: `${mei.slice(0, -1)}${VOWEL_SIGNS[index]}`, consonant_id: `consonant-${target}`, vowel_id: `letter-${vowel}`, vowel_target: vowel, transliteration: `${target}${vowel}`, tip_ta: 'எழுத்தைப் பழகலாம்.', tip: 'Study this combined letter.', can_evaluate: false }))),
  ...WORDS.map(row => phrase('word', row)), ...SENTENCES.map(row => phrase('sentence', row)),
]
const PROGRESS = { total_attempts: 3, scored_attempts: 2, recognition_attempts: 0, recognition_correct: 0, completed_total: 1, lesson_total: 264, completed_items: ['word-amma'], average_score: 75, by_kind: { vowel: { attempts: 0, completed: 0, total: 12, average_score: null }, consonant: { attempts: 0, completed: 0, total: 18, average_score: null }, aytham: { attempts: 0, completed: 0, total: 1, average_score: null }, uyirmei: { attempts: 0, completed: 0, total: 216, average_score: null }, word: { attempts: 2, completed: 1, total: 9, average_score: 70 }, sentence: { attempts: 1, completed: 0, total: 8, average_score: 80 } }, recent_attempts: [{ id: 'saved-word', item_id: 'word-amma', text: 'அம்மா', kind: 'word', scorable: true, correct: true, accuracy: 70 }] }

// Playable audio for browser contract tests, not a pronunciation-model fixture.
function testWav() {
  const rate = 8000, samples = 24000
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++) buffer.writeInt16LE(Math.round(Math.sin(index / rate * Math.PI * 440) * 3000), 44 + index * 2)
  return buffer
}

async function setup(page, { abstainFirst = false, withAudio = true } = {}) {
  const state = { uploads: [], answers: [] }
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort())
  await page.route('**/assets/tamil-reference/*.wav', route => route.fulfill({ contentType: 'audio/wav', body: testWav() }))
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: { id: 'tamil-fixture-parent', role: 'user', full_name: 'Tamil Test Parent', child_name: 'Kavi', child_age: 7 } })
    if (path === '/api/tamil/catalog') return route.fulfill({ json: { items: CATALOG.map(item => withAudio ? item : { ...item, audio_url: undefined, audio_kind: undefined }) } })
    if (path === '/api/tamil/progress') return route.fulfill({ json: PROGRESS })
    if (path === '/api/tamil/answer') {
      const answer = request.postDataJSON()
      state.answers.push(answer)
      const item = CATALOG.find(row => row.id === answer.item_id)
      const correct = answer.prompt_type === 'uyirmei_composition'
        ? JSON.stringify(answer.selected_ids) === JSON.stringify([item.consonant_id, item.vowel_id])
        : answer.prompt_type === 'sentence_ordering'
          ? JSON.stringify(answer.selected_ids) === JSON.stringify(item.text.split(/\s+/u).map((_, index) => String(index)))
          : answer.prompt_type === 'text_writing'
            ? answer.written_text?.trim() === item.text
          : answer.item_id === answer.selected_id
      return route.fulfill({ json: { result: { item_id: item.id, text: item.text, kind: item.kind, correct, score_method: ['meaning_matching', 'uyirmei_composition', 'sentence_ordering', 'text_writing'].includes(answer.prompt_type) ? 'catalog_exercise_v1' : 'catalog_recognition_v1', scorable: false, accuracy: null }, progress: PROGRESS, already_saved: false } })
    }
    if (path === '/api/tamil/evaluate') {
      const body = request.postDataBuffer()
      const string = body.toString('latin1')
      const field = name => {
        const value = string.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]+)`))?.[1]
        return value == null ? value : Buffer.from(value, 'latin1').toString('utf8')
      }
      const item = CATALOG.find(row => row.id === field('item_id'))
      expect(item).toBeTruthy()
      expect(body.length).toBeGreaterThan(1000)
      expect(field('request_id')).toBeTruthy()
      state.uploads.push({ item_id: item.id, request_id: field('request_id'), browser_transcript: field('browser_transcript') })
      const result = abstainFirst && state.uploads.length === 1
        ? { id: 'attempt-unscored', item_id: item.id, kind: item.kind, text: item.text, scorable: false, accuracy: null, confidence: null, validation_status: 'no_speech', feedback: 'No clear speech was heard. Please try this example again.' }
        : { id: `attempt-${state.uploads.length}`, item_id: item.id, kind: item.kind, text: item.text, scorable: true, correct: true, phoneme_match: true, accuracy: 100, confidence: .81, feedback: 'The complete target matched.', expected_phonemes: ['a', 'm', 'aː'], actual_phonemes: ['a', 'm', 'aː'], phoneme_alignment: [{ expected: 'a', actual: 'a', operation: 'correct' }] }
      return route.fulfill({ json: { result, progress: { ...PROGRESS, total_attempts: 3 + state.uploads.length }, already_saved: false } })
    }
    if (path === '/api/vowels/sessions') {
      const target = request.postDataJSON().target_phoneme
      return route.fulfill({ json: { id: 'studio-fixture', session_id: 'studio-fixture', mode: 'practice', challenges: [{ target_phoneme: target, identity: target[0].toUpperCase(), length: target.length === 1 ? 'short' : 'long', symbol: VOWELS.find(([key]) => key === target)?.[1] }] } })
    }
    return route.fulfill({ status: 404, json: { detail: `Unexpected test endpoint: ${path}` } })
  })
  await page.addInitScript(() => {
    window.__tamilEvidence = { streams: [], durations: [], spoken: [], audio: [] }
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.__tamilMediaRequest = async constraints => { const stream = await original(constraints); window.__tamilEvidence.streams.push(stream); return stream }
    navigator.mediaDevices.getUserMedia = window.__tamilMediaRequest
    const NativeRecorder = MediaRecorder
    window.MediaRecorder = class extends NativeRecorder {
      start(...args) { this.startTime = performance.now(); return super.start(...args) }
      stop() { window.__tamilEvidence.durations.push(performance.now() - this.startTime); return super.stop() }
    }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ name: 'English voice', lang: 'en-US' }], speak: utterance => window.__tamilEvidence.spoken.push(utterance.text), cancel() {}, addEventListener() {}, removeEventListener() {} } })
    const TamilRecognition = class {
      abort() {}
      start() {
        this.onstart?.()
        setTimeout(() => this.onresult?.({ results: [[{ transcript: 'அம்மா' }]] }), 30)
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: TamilRecognition })
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: TamilRecognition })
    const NativeAudio = window.Audio
    window.Audio = function ObservedAudio(source) { const audio = new NativeAudio(source); window.__tamilEvidence.audio.push(audio); return audio }
  })
  return state
}

async function record(page) {
  await page.getByRole('button', { name: /Start recording/ }).click()
  await expect(page.locator('.tamil-practice-page')).toHaveAttribute('data-state', 'RECORDING')
  await expect(page.getByRole('button', { name: /Stop and discard|Stop example/ })).toHaveCount(0)
  await expect(page.locator('.tamil-practice-page')).toHaveAttribute('data-state', /RESULT|RETRY/, { timeout: 18000 })
}

test('Tamil hub shows vowels, consonants and twelve combined letters per base with keyboard-operable levels', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await setup(page)
  await page.goto('/tamil')
  await expect(page.locator('.tamil-grid-vowel h3')).toHaveText(VOWELS.map(([, letter]) => letter))
  await expect(page.locator('.tamil-card-meta span').filter({ hasText: /^குறில்$/ })).toHaveCount(5)
  await expect(page.locator('.tamil-card-meta span').filter({ hasText: /^நெடில்$/ })).toHaveCount(7)
  await expect(page.getByRole('link', { name: 'ஔ — practise vowel' })).toHaveAttribute('href', '/tamil/practice/letter-au')
  await expect(page.getByRole('link', { name: 'ஆ — practise vowel' })).toHaveAttribute('href', '/tamil/practice/letter-aa')
  await expect(page.locator('.tamil-transliteration')).toHaveCount(0)
  await page.getByRole('checkbox', { name: /Show pronunciation hints/ }).check()
  await expect(page.locator('.tamil-transliteration')).toHaveCount(12)
  await page.screenshot({ path: testInfo.outputPath('tamil-hub-desktop.png'), fullPage: true })
  await page.getByRole('tab', { name: /Vowels/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: /Consonants/ })).toBeFocused()
  await expect(page.locator('.tamil-grid-consonant h3')).toHaveText(CONSONANTS.map(([, letter]) => letter))
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: /Aytham/ })).toBeFocused()
  await expect(page.locator('.tamil-grid-aytham h3')).toHaveText(['ஃ'])
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: /Combined letters/ })).toBeFocused()
  await expect(page.locator('.tamil-grid-uyirmei h3')).toHaveText(VOWELS.map(([, letter], index) => `க${VOWEL_SIGNS[index]}`))
  await page.getByLabel(/Choose a consonant/).selectOption('consonant-nga')
  await expect(page.locator('.tamil-grid-uyirmei h3')).toHaveText(VOWELS.map(([, letter], index) => `ங${VOWEL_SIGNS[index]}`))
  await page.getByRole('navigation', { name: 'Tamil training sections' }).getByRole('button', { name: /Words/ }).click()
  await expect(page.locator('.tamil-grid-word h3')).toHaveText(WORDS.map(([, text]) => text))
  await page.getByRole('navigation', { name: 'Tamil training sections' }).getByRole('button', { name: /Sentences/ }).click()
  await expect(page.locator('.tamil-grid-sentence h3')).toHaveText(SENTENCES.map(([, text]) => text))
  await expect(page.locator('.tamil-category-heading .tamil-level-label')).toHaveText('Level 6')
  await expect(page.locator('.tamil-progress-numbers')).toContainText('75%')
  await expect(page.locator('.tamil-recent-attempts')).toContainText('70 / 100')
})

test('recognition answer is checked and saved for a consonant lesson', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/tamil/practice/consonant-ka')
  await expect(page.getByRole('heading', { name: 'க்', exact: true })).toBeVisible()
  await expect(page.getByText(/A Tamil audio example is still needed for this letter/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Start recording/ })).toHaveCount(0)
  await page.getByRole('link', { name: /Start recognition challenge/ }).click()
  await expect(page).toHaveURL(/\/tamil\/quiz\/consonant-ka$/)
  await expect(page.getByRole('heading', { name: 'க்', exact: true })).toHaveCount(0)
  await page.locator('.tamil-quiz-choice').filter({ hasText: 'க்' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(fixture.answers).toHaveLength(1)
  expect(fixture.answers[0]).toMatchObject({ item_id: 'consonant-ka', selected_id: 'consonant-ka', prompt_type: 'character_recognition' })
  await page.getByRole('button', { name: /Next lesson/ }).click()
  await expect(page).toHaveURL(/consonant-nga$/)
  await page.goto('/tamil/practice/uyirmei-ka-aa')
  await expect(page.locator('.tamil-letter-equation')).toContainText('க்')
  await expect(page.locator('.tamil-letter-equation')).toContainText('ஆ')
  await expect(page.locator('.tamil-letter-equation')).toContainText('கா')
})

test('listening challenge plays a local example and saves an audio-recognition answer', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/tamil/quiz/word-amma')
  await page.getByRole('button', { name: 'Listen and choose' }).click()
  await expect(page.getByRole('heading', { name: /Listen to the Tamil example/ })).toBeVisible()
  await expect(page.locator('audio.tamil-quiz-audio')).toHaveAttribute('src', '/assets/tamil-reference/word-amma-valluvar.wav')
  await page.locator('audio.tamil-quiz-audio').evaluate(async audio => { await audio.play(); audio.pause() })
  await page.locator('.tamil-quiz-choice').filter({ hasText: WORDS[0][1] }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(fixture.answers).toHaveLength(1)
  expect(fixture.answers[0]).toMatchObject({ item_id: 'word-amma', selected_id: 'word-amma', prompt_type: 'audio_recognition' })
})

test('combined-letter construction and meaning matching save graded exercise attempts', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/tamil/quiz/uyirmei-ka-aa')
  await page.getByRole('button', { name: 'Build letter' }).click()
  await expect(page.locator('.tamil-quiz-target')).toHaveText('கா')
  await page.getByRole('combobox', { name: /Consonant/ }).selectOption('consonant-ka')
  await page.getByRole('combobox', { name: /Vowel/ }).selectOption('letter-aa')
  await page.getByRole('button', { name: 'Check letter' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(fixture.answers[0]).toMatchObject({ item_id: 'uyirmei-ka-aa', prompt_type: 'uyirmei_composition', selected_ids: ['consonant-ka', 'letter-aa'] })

  await page.goto('/tamil/quiz/word-amma')
  await page.getByRole('button', { name: 'Match meaning' }).click()
  await expect(page.locator('.tamil-quiz-target')).toHaveText('அம்மா')
  await page.getByRole('button', { name: 'Mother', exact: true }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(fixture.answers[1]).toMatchObject({ item_id: 'word-amma', selected_id: 'word-amma', prompt_type: 'meaning_matching' })
})

test('sentence reconstruction saves the chosen word order', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/tamil/quiz/sentence-amma-veettil')
  await page.getByRole('button', { name: 'Arrange words' }).click()
  const bank = page.locator('.tamil-quiz-word-row[aria-label="Available words"]')
  for (const word of SENTENCES[0][1].split(/\s+/u)) await bank.getByRole('button', { name: word, exact: true }).click()
  await expect(page.locator('.tamil-quiz-word-row[aria-label="Your sentence"]')).toContainText(SENTENCES[0][1].split(/\s+/u)[0])
  await page.getByRole('button', { name: 'Check order' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(fixture.answers[0]).toMatchObject({ item_id: 'sentence-amma-veettil', prompt_type: 'sentence_ordering', selected_ids: ['0', '1', '2'] })
})

test('a due review is linked from saved Tamil progress', async ({ page }) => {
  await setup(page)
  await page.route('**/api/tamil/progress', route => route.fulfill({ json: { ...PROGRESS, review_due_items: ['word-amma'] } }))
  await page.goto('/tamil?kind=word')
  await expect(page.locator('.tamil-review-due')).toContainText('Ready for another look')
  await page.locator('.tamil-review-due').getByRole('link', { name: /அம்மா/ }).click()
  await expect(page).toHaveURL(/\/tamil\/quiz\/word-amma$/)
})

test('Tamil writing checks entered script, gives feedback, and allows another saved attempt', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/tamil/quiz/word-amma')
  await page.getByRole('button', { name: 'Type Tamil' }).click()
  await expect(page.getByRole('heading', { name: /Write the Tamil for: Mother/ })).toBeVisible()
  await page.getByLabel('Your Tamil answer').fill('அப்பா')
  await page.getByRole('button', { name: 'Check writing' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Keep practising')
  await page.getByRole('button', { name: 'Retry' }).click()
  await page.getByLabel('Your Tamil answer').fill('அம்மா')
  await page.getByRole('button', { name: 'Check writing' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(fixture.answers).toHaveLength(2)
  expect(fixture.answers[1]).toMatchObject({ item_id: 'word-amma', prompt_type: 'text_writing', written_text: 'அம்மா' })
  expect(fixture.answers[0].request_id).not.toBe(fixture.answers[1].request_id)
})

test('aytham is a distinct written lesson with a working challenge', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/tamil/practice/aytham-symbol')
  await expect(page.getByRole('heading', { name: 'ஃ', exact: true })).toBeVisible()
  await expect(page.getByText('Aytham is learned as a written symbol.')).toBeVisible()
  await page.getByRole('link', { name: /Start recognition challenge/ }).click()
  await expect(page.getByRole('heading', { name: 'Write the Tamil aytham symbol.' })).toBeVisible()
  await page.getByLabel('Your Tamil answer').fill('ஃ')
  await page.getByRole('button', { name: 'Check writing' }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(fixture.answers.at(-1)).toMatchObject({ item_id: 'aytham-symbol', prompt_type: 'text_writing', written_text: 'ஃ' })
})

test('vowel lessons show the exact voiced one-second rule', async ({ page }) => {
  await setup(page)
  await page.goto('/tamil/practice/letter-ee')
  await expect(page.locator('.tamil-duration-rule')).toContainText('> 1.00 s')
  await expect(page.locator('.tamil-duration-rule .is-target')).toContainText('நெடில் · long')
  await expect(page.locator('.tamil-duration-rule')).toContainText('silence in the recording does not')
})

test('lesson and recording motion respond to activity and reduced-motion preference', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await setup(page)
  await page.goto('/tamil')
  await expect(page.locator('.tamil-learning-card').first()).toBeVisible()
  expect(await page.locator('.tamil-learning-card').first().evaluate(node => getComputedStyle(node).animationName)).toContain('tamil-card-arrive')
  await page.goto('/tamil/practice/letter-ee')
  await expect(page.locator('.tamil-duration-rule')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('long-vowel-practice.png'), fullPage: true })
  await page.getByRole('button', { name: /Start recording/ }).click()
  await expect(page.locator('.tamil-practice-page')).toHaveAttribute('data-state', 'RECORDING')
  expect(await page.locator('.tamil-record-orbit').evaluate(node => getComputedStyle(node).animationName)).toContain('tamil-orbit-breathe')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.tamil-record-orbit').evaluate(node => getComputedStyle(node).animationName)).toBe('none')
})

test('a lost recognition response retries with the same request ID', async ({ page }) => {
  await setup(page)
  const attempts = []
  await page.route('**/api/tamil/answer', async route => {
    attempts.push(route.request().postDataJSON())
    if (attempts.length === 1) return route.abort('failed')
    return route.fulfill({ json: { result: { correct: true, text: CONSONANTS[0][1] }, progress: PROGRESS, already_saved: true } })
  })
  await page.goto('/tamil/quiz/consonant-ka')
  await page.locator('.tamil-quiz-choice').filter({ hasText: CONSONANTS[0][1] }).click()
  await expect(page.getByRole('alert')).toContainText('could not be saved')
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.locator('.tamil-quiz-choice').filter({ hasText: CONSONANTS[0][1] }).click()
  await expect(page.locator('.tamil-quiz-feedback')).toContainText('Correct')
  expect(attempts).toHaveLength(2)
  expect(attempts[0].request_id).toBe(attempts[1].request_id)
})

test('word practice plays local Tamil audio, stops it before a real seven-second recording, and retries an abstention', async ({ page }) => {
  const fixture = await setup(page, { abstainFirst: true })
  await page.goto('/tamil/practice/word-amma')
  await expect(page.getByRole('heading', { name: 'அம்மா', exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic Tamil reference', { exact: true })).toBeVisible()
  const stopExample = page.getByRole('button', { name: /Stop example/ })
  if (await stopExample.isVisible()) await stopExample.click()
  await page.getByRole('button', { name: /Listen to Tamil example/ }).click()
  await expect.poll(() => page.evaluate(() => window.__tamilEvidence.audio.length)).toBeGreaterThan(0)
  await record(page)
  expect(await page.evaluate(() => window.__tamilEvidence.audio.every(audio => audio.paused))).toBe(true)
  expect(await page.evaluate(() => window.__tamilEvidence.spoken)).toEqual([])
  await expect(page.locator('.tamil-score')).toHaveCount(0)
  await expect(page.getByText('This attempt could not be scored confidently.')).toBeVisible()
  const duration = await page.evaluate(() => window.__tamilEvidence.durations[0])
  expect(duration).toBeGreaterThanOrEqual(6900)
  // Browser timers can drift when the local model and Gradle builds compete for CPU.
  expect(duration).toBeLessThan(12000)
  await page.getByRole('button', { name: /Try again/ }).click()
  await record(page)
  expect(fixture.uploads).toHaveLength(2)
  expect(fixture.uploads[0].item_id).toBe('word-amma')
  expect(fixture.uploads.map(upload => upload.browser_transcript)).toEqual(['அம்மா', 'அம்மா'])
  expect(fixture.uploads[0].request_id).not.toBe(fixture.uploads[1].request_id)
  await expect(page.getByText('Phoneme comparison', { exact: true })).toBeVisible()
  await expect(page.locator('.tamil-phoneme-comparison')).toContainText('a m aː')
  await expect(page.locator('.tamil-confidence')).toContainText('81%')
  await expect(page.locator('.tamil-method-note')).toContainText('not a Tamil transcript')
  await expect(page.getByText('Correct', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__tamilEvidence.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true)
})

test('permission denial can be retried and leaving a recording releases the microphone without uploading', async ({ page }) => {
  const fixture = await setup(page)
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError') } })
  await page.goto('/tamil/practice/word-appa')
  await page.getByRole('button', { name: /Start recording/ }).click()
  await expect(page.getByRole('alert')).toContainText('Allow it in your browser settings')
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__tamilMediaRequest })
  await page.getByRole('button', { name: /Start recording/ }).click()
  await expect(page.locator('.tamil-practice-page')).toHaveAttribute('data-state', 'RECORDING')
  await expect(page.getByRole('button', { name: /Stop and discard/ })).toHaveCount(0)
  await page.locator('.tamil-practice-toolbar button').click()
  await expect(page).toHaveURL(/\/tamil\?kind=word$/)
  expect(fixture.uploads).toHaveLength(0)
  expect(await page.evaluate(() => window.__tamilEvidence.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true)
})

test('sentence practice sends the sentence ID with real audio and keeps the Tamil text intact', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/tamil/practice/sentence-amma-veettil')
  await expect(page.getByRole('heading', { name: 'அம்மா வீட்டில் இருக்கிறார்.', exact: true })).toBeVisible()
  await expect(page.getByText('Mother is at home.', { exact: true })).toBeVisible()
  await record(page)
  expect(fixture.uploads[0].item_id).toBe('sentence-amma-veettil')
  await expect(page.getByText('Phoneme comparison', { exact: true })).toBeVisible()
  await expect(page.locator('.tamil-grammar-label')).toHaveCount(0)
})

test('submitted Tamil audio cannot be misleadingly discarded while the server saves its result', async ({ page }) => {
  const fixture = await setup(page)
  let releaseResponse
  const pendingResponse = new Promise(resolve => { releaseResponse = resolve })
  await page.route('**/api/tamil/evaluate', async route => {
    await pendingResponse
    await route.fallback()
  })
  await page.goto('/tamil/practice/word-amma')
  await page.getByRole('button', { name: /Start recording/ }).click()
  await expect(page.locator('.tamil-practice-page')).toHaveAttribute('data-state', 'PROCESSING', { timeout: 18000 })
  await expect(page.locator('.tamil-auto-status')).toContainText('Comparing sounds')
  await expect(page.getByRole('button', { name: /Stop and discard/ })).toHaveCount(0)
  await expect(page.getByText(/Your result may still be saved if you leave this page/)).toBeVisible()
  releaseResponse()
  await expect(page.locator('.tamil-practice-page')).toHaveAttribute('data-state', 'RESULT')
  expect(fixture.uploads).toHaveLength(1)
})

test('ஐ and ஔ use separate vowel practice and never fall back to an English example voice', async ({ page }) => {
  await setup(page, { withAudio: false })
  await page.goto('/tamil/practice/letter-au')
  await expect(page.getByRole('heading', { name: 'ஔ', exact: true })).toBeVisible()
  await expect(page.locator('.tamil-grammar-label')).toContainText('நெடில்')
  await expect(page.getByRole('button', { name: /Listen to Tamil example/ })).toBeDisabled()
  await expect(page.getByText('A Tamil audio example is still needed for this lesson. You can continue with recognition and writing.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Start recording/ })).toBeEnabled()
  expect(await page.evaluate(() => window.__tamilEvidence.spoken)).toEqual([])
  await page.goto('/tamil/practice/letter-ai')
  await expect(page.getByRole('heading', { name: 'ஐ', exact: true })).toBeVisible()
  await expect(page.locator('.vowel-length-guide')).toHaveCount(0)
  await page.goto('/tamil/practice/letter-aa')
  await expect(page).toHaveURL(/\/tamil\/practice\/letter-aa$/)
})

test('mobile Tamil pages fit their viewport and use the Tamil font for visible prompts', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto('/tamil?kind=sentence')
  await expect(page.locator('.tamil-grid-sentence h3')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'நாய் ஓடுகிறது. — practise sentence' }).click()
  await expect(page.getByRole('heading', { name: 'நாய் ஓடுகிறது.' })).toBeVisible()
  expect(await page.locator('.tamil-example h1').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Noto Sans Tamil')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('.tamil-pippin .pippin-story-scene')).toHaveAttribute('data-transparent', 'true')
  expect(await page.locator('.tamil-world').evaluate(element => getComputedStyle(element, '::before').position)).toBe('fixed')
  await page.screenshot({ path: testInfo.outputPath('tamil-sentence-mobile.png'), fullPage: true })
  await page.evaluate(() => { document.scrollingElement.scrollTop = 700 })
  await expect.poll(() => page.evaluate(() => document.scrollingElement.scrollTop)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('tamil-sentence-mobile-scrolled.png') })
})

test('Tamil letters, words, and sentences keep learning, practice, and Pippin in one desktop row', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 900 })
  await setup(page)
  for (const itemId of ['letter-a', 'consonant-ka', 'aytham-symbol', 'uyirmei-ka-aa', 'word-amma', 'sentence-amma-veettil']) {
    await page.goto('/tamil/practice/' + itemId)
    const grid = page.locator('.tamil-practice-grid')
    await expect(grid.locator(':scope > *')).toHaveCount(3)
    const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean))
    expect(columns).toHaveLength(3)
    const cards = await grid.locator(':scope > *').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom }
    }))
    expect(Math.max(...cards.map(card => card.top)) - Math.min(...cards.map(card => card.top))).toBeLessThan(2)
    const viewportHeight = await page.evaluate(() => innerHeight)
    expect(Math.max(...cards.map(card => card.bottom))).toBeLessThanOrEqual(viewportHeight + 1)
    const coach = page.locator('.tamil-practice-grid > .tamil-pippin-card .pippin-story-scene')
    await expect(coach).toBeVisible()
    await expect(coach).toHaveAttribute('data-transparent', 'true')
    expect(await coach.locator('svg > rect').count()).toBe(0)
    expect((await coach.boundingBox()).width).toBeGreaterThan(160)
    const scene = await page.locator('.tamil-world').evaluate(element => {
      const style = getComputedStyle(element, '::before')
      return { position: style.position, image: style.backgroundImage }
    })
    expect(scene.position).toBe('fixed')
    expect(scene.image).toContain('ivory-floral-content.png')
    if (itemId === 'word-amma') await page.screenshot({ path: testInfo.outputPath('three-card-word-layout.png'), fullPage: true })
  }
})
