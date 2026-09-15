// Optional local hardware check. Records two seconds in memory and immediately
// releases the device; no raw audio is saved or sent anywhere.
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] })
try {
  const context = await browser.newContext({ permissions: ['microphone'] })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:8000/health/live')
  const result = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    try {
      const track = stream.getAudioTracks()[0]
      const recorder = new MediaRecorder(stream)
      const chunks = []
      const ended = new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
        recorder.onstop = () => resolve()
        recorder.onerror = reject
      })
      recorder.start()
      await new Promise((resolve) => setTimeout(resolve, 2000))
      recorder.stop()
      await ended
      return { readyState: track.readyState, sampleRate: track.getSettings().sampleRate,
        bytes: new Blob(chunks).size, mimeType: recorder.mimeType }
    } finally {
      stream.getTracks().forEach((track) => track.stop())
    }
  })
  if (result.readyState !== 'live' || result.bytes <= 0) throw new Error('No live microphone audio captured')
  console.info(JSON.stringify({ physicalMicrophoneCapture: 'passed', ...result }))
} finally {
  await browser.close()
}
