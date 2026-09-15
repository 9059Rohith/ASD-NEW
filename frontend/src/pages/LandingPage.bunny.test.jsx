import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const landingSource = readFileSync(new URL('./LandingPage.jsx', import.meta.url), 'utf8')

describe('LandingPage premium public contract', () => {
  it('connects the new vowel experience to real practice without unsupported claims', () => {
    expect(landingSource).toContain('<span>FIND</span><br /><span>YOUR</span><br /><em>VOICE.</em>')
    expect(landingSource).toContain('to="/tamil"')
    expect(landingSource).toContain('12 உயிரெழுத்துகள்')
    expect(landingSource).toContain('letter-ai')
    expect(landingSource).toContain('letter-au')
    expect(landingSource).toContain('not raw microphone recordings')
    expect(landingSource).not.toMatch(/testimonial|trusted by|success stories/i)
    expect(landingSource).not.toMatch(/href=["']#["']/)
  })
})
