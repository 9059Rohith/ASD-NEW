import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import HomeSlideshow, { HOME_SLIDES } from './HomeSlideshow'

describe('Tamil homepage slideshow', () => {
  it('exposes one named slide, navigation, and an explicit pause control', () => {
    const html = renderToStaticMarkup(<MemoryRouter><HomeSlideshow /></MemoryRouter>)
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Pause slideshow"')
    expect(html).toContain('aria-label="Previous slide"')
    expect(html).toContain('aria-label="Next slide"')
    expect(html).toContain('aria-live="off"')
    expect(html).toContain('lang="ta"')
    expect(html).toContain('/tamil?kind=vowel')
    expect(html).not.toContain('<audio')
  })
  it('offers authentic vowel, word, and sentence learning destinations', () => {
    expect(HOME_SLIDES.map(slide => slide.to)).toEqual(['/tamil?kind=vowel', '/tamil?kind=word', '/tamil?kind=sentence'])
    expect(HOME_SLIDES.map(slide => slide.sample)).toEqual(['அ ஆ', 'அம்மா', 'அம்மா, வா.'])
  })
})
