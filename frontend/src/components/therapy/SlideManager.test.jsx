import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SlideManager from './SlideManager'

describe('therapy slide layout', () => {
  it('renders the lesson without a Pippin training coach', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SlideManager lesson={{
          id: 1,
          type: 'letter',
          symbol: 'அ',
          english: 'A',
          phoneme: 'a',
          difficulty: 1,
          voice_language: 'ta-IN',
        }} />
      </MemoryRouter>,
    )

    expect(html).toContain('அ')
    expect(html).not.toContain('Pippin training coach')
    expect(html).not.toContain('pippin-training-panel')
  })
})
