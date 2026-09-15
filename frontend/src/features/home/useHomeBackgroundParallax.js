import { useEffect } from 'react'

// Scroll only changes a CSS variable on visible decorative layers. Text and
// controls remain fixed, and no React render is scheduled during scrolling.
export default function useHomeBackgroundParallax(reduced) {
  useEffect(() => {
    const sections = [...document.querySelectorAll('.voice-home [data-parallax-background]')]
    if (reduced || sections.length === 0) return

    let frame = 0
    const paint = () => {
      frame = 0
      if (document.hidden) return
      const center = window.innerHeight / 2
      sections.forEach(section => {
        const box = section.getBoundingClientRect()
        if (box.bottom < 0 || box.top > window.innerHeight) return
        const distance = (center - (box.top + box.height / 2)) / Math.max(box.height, window.innerHeight)
        const shift = Math.max(-30, Math.min(30, distance * 60))
        section.style.setProperty('--home-bg-shift', `${shift.toFixed(1)}px`)
      })
    }
    const schedule = () => {
      if (!frame && !document.hidden) frame = window.requestAnimationFrame(paint)
    }
    const visibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame)
        frame = 0
      } else schedule()
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    schedule()
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', visibility)
      sections.forEach(section => section.style.removeProperty('--home-bg-shift'))
    }
  }, [reduced])
}
