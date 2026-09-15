import { defineConfig } from '@playwright/test'
import path from 'node:path'

export default defineConfig({
  testDir: './integration-live',
  timeout: 180000,
  expect: { timeout: 20000 },
  workers: 1,
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:5173',
    permissions: ['microphone', 'camera'],
    launchOptions: { args: [
      '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.resolve('../backend/tests/fixtures/jfk.wav')}`,
    ] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 120000,
  },
})
