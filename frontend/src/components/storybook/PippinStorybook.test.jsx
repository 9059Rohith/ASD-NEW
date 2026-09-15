import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PippinStorybook from './PippinStorybook'

describe('PippinStorybook practice states', () => {
  it.each(['listening', 'processing', 'success', 'retry', 'teaching'])('exposes the %s mood to animation and assistive text', mood => {
    const html = renderToStaticMarkup(<PippinStorybook mood={mood} message={`Pippin is ${mood}`} compact />)
    expect(html).toContain(`data-mood="${mood}"`)
    expect(html).toContain(`Pippin is ${mood}`)
    expect(html).toContain('data-compact="true"')
  })
})
