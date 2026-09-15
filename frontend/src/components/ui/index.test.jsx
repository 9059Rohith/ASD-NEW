import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GradientButton } from './index'

describe('GradientButton', () => {
  it('defaults to a non-submitting button', () => {
    const html = renderToStaticMarkup(<GradientButton>Continue</GradientButton>)
    expect(html).toContain('type="button"')
  })

  it('exposes a disabled busy state with a stable accessible label', () => {
    const html = renderToStaticMarkup(<GradientButton loading loadingLabel="Saving progress">Save</GradientButton>)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-label="Saving progress"')
    expect(html).toContain('Saving progress')
  })
})
