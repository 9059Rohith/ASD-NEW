import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import InteractiveBunny from './InteractiveBunny'

describe('InteractiveBunny', () => {
  it('renders an accessible live SVG character without canvas', () => {
    const html = renderToStaticMarkup(
      <InteractiveBunny mood="happy" showBubble message="Hello, friend!" />,
    )

    expect(html).toContain('data-testid="interactive-bunny"')
    expect(html).toContain('data-mood="happy"')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Bunny companion is happy. Hello, friend!"')
    expect(html).toContain('Hello, friend!')
    expect(html).toContain('<svg')
    expect(html).toContain('bunny-eyelid')
    expect(html).toContain('bunny-arm')
    expect(html).not.toContain('<canvas')
  })

  it('clamps audio response and exposes the requested size', () => {
    const html = renderToStaticMarkup(
      <InteractiveBunny mood="listen" audioLevel={2} size={420} />,
    )

    expect(html).toContain('data-audio-level="1"')
    expect(html).toContain('height:420px')
  })
})
