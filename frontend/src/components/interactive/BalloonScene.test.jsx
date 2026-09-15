import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BalloonScene from './BalloonScene'

describe('BalloonScene', () => {
  it('renders the requested expression and preserves its accessible meter', () => {
    const html = renderToStaticMarkup(<BalloonScene level={0.9} target={[0.25, 0.7]} active visualState="too-strong" motionLevel="full" />)
    expect(html).toContain('data-visual-state="too-strong"')
    expect(html).toContain('balloon-face')
    expect(html).toContain('Voice level 90 percent')
  })

  it('renders the flight reward only for completion', () => {
    expect(renderToStaticMarkup(<BalloonScene level={0} visualState="complete" motionLevel="full" />)).toContain('balloon-flight-reward')
    expect(renderToStaticMarkup(<BalloonScene level={0} visualState="idle" motionLevel="full" />)).not.toContain('balloon-flight-reward')
  })

  it('renders a full moving sky with spaced Tamil letter balloons', () => {
    const obstacles = [
      { id: 'a', letter: 'அ', sound: 'a', threshold: .18 },
      { id: 'aa', letter: 'ஆ', sound: 'aa', threshold: .4 },
      { id: 'i', letter: 'இ', sound: 'i', threshold: .62 },
      { id: 'ii', letter: 'ஈ', sound: 'ii', threshold: .84 },
    ]
    const html = renderToStaticMarkup(<BalloonScene level={.4} active obstacles={obstacles} />)
    expect((html.match(/balloon-scene__cloud/g) || []).length).toBeGreaterThanOrEqual(5)
    expect((html.match(/letter-balloon/g) || []).length).toBe(4)
    expect(html).toContain('--lane:18%')
    expect(html).toContain('balloon-scene--continuous')
  })
})
