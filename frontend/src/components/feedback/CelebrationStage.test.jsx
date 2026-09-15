import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CelebrationStage from './CelebrationStage'
import LiveMotivationAnimal from './LiveMotivationAnimal'

describe('celebration stage', () => {
  it('renders a gentle low-score celebration without high-intensity effects', () => {
    const html = renderToStaticMarkup(<CelebrationStage accuracy={12} active />)
    expect(html).toContain('data-feedback-tier="sprout"')
    expect(html).toContain('data-effect="sparkles"')
    expect(html).not.toContain('data-effect="fireworks"')
  })

  it('renders the complete ultimate sequence at 95 percent', () => {
    const html = renderToStaticMarkup(<CelebrationStage accuracy={95} active />)
    for (const effect of ['confetti', 'rainbow', 'butterflies', 'fireworks', 'trophy', 'crown', 'coins']) {
      expect(html).toContain(`data-effect="${effect}"`)
    }
    expect(html).toContain('aria-label="You Did It! Perfect pronunciation!"')
  })

  it('keeps the message and rewards but suppresses travel effects for reduced motion', () => {
    const html = renderToStaticMarkup(<CelebrationStage accuracy={100} active reducedMotion />)
    expect(html).toContain('data-motion="reduced"')
    expect(html).toContain('data-effect="trophy"')
    expect(html).not.toContain('data-effect="confetti"')
    expect(html).not.toContain('data-effect="fireworks"')
  })
})

describe('live motivation animal', () => {
  it('renders only while the pronunciation interaction is active', () => {
    expect(renderToStaticMarkup(<LiveMotivationAnimal active={false} />)).toBe('')
    const html = renderToStaticMarkup(<LiveMotivationAnimal active state="listening" seed={3} />)
    expect(html).toContain('data-testid="live-motivation-animal"')
    expect(html).toContain('data-state="listening"')
    expect(html).toContain('role="img"')
  })

  it('never exposes a sad state and celebrates every score', () => {
    const html = renderToStaticMarkup(<LiveMotivationAnimal active state="celebrating" accuracy={5} seed={8} />)
    expect(html).toContain('data-state="celebrating"')
    expect(html).not.toMatch(/sad|frown|disappointed/i)
  })
})
