import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Slide1_Picture from './Slide1_Picture'

describe('word lesson pictures', () => {
  it.each([
    ['amma', '/assets/words/amma.png'], ['appa', '/assets/words/appa.png'],
    ['maram', '/assets/words/maram.png'], ['pazham', '/assets/words/pazham.png'],
  ])('renders the animated %s image', (phoneme, image) => {
    const html = renderToStaticMarkup(<Slide1_Picture lesson={{ symbol: phoneme, english: phoneme.toUpperCase(), phoneme, image, type: 'word', difficulty: 3 }} />)
    expect(html).toContain(`src="${image}"`)
    expect(html).toContain(`data-picture-motion="${phoneme}"`)
    expect(html).toContain('data-testid="dedicated-word-picture-slide"')
    expect(html).not.toContain('data-testid="letter-picture-layout"')
  })
})
