import { useEffect, useRef } from 'react'

// Animate decoration only. No continuous render loop, scroll interception or
// React state updates per frame; preserve CSS entrance and orbit transforms.
export default function useHomeParallax(reduced) {
  const root = useRef(null)
  useEffect(() => {
    const element = root.current
    if (!element || reduced) return
    const fine = window.matchMedia('(pointer: fine)')
    let frame = 0
    let x = 0
    let y = 0
    const reset = () => {
      element.style.removeProperty('--scene-x')
      element.style.removeProperty('--scene-y')
      element.style.removeProperty('--scene-scroll')
    }
    const paint = () => {
      frame = 0
      if (document.hidden) return
      const box = element.getBoundingClientRect()
      if (box.bottom < 0 || box.top > window.innerHeight) return
      element.style.setProperty('--scene-x', `${x.toFixed(2)}px`)
      element.style.setProperty('--scene-y', `${y.toFixed(2)}px`)
      element.style.setProperty('--scene-scroll', `${Math.max(-20, Math.min(20, -box.top * .035)).toFixed(2)}px`)
    }
    const schedule = () => { if (!frame && !document.hidden) frame = window.requestAnimationFrame(paint) }
    const move = event => {
      if (!fine.matches || event.pointerType === 'touch') return
      const box = element.getBoundingClientRect()
      x = Math.max(-10, Math.min(10, ((event.clientX - box.left) / box.width - .5) * 20))
      y = Math.max(-7, Math.min(7, ((event.clientY - box.top) / box.height - .5) * 14))
      schedule()
    }
    const leave = () => { x = 0; y = 0; schedule() }
    const visibility = () => {
      if (document.hidden) { window.cancelAnimationFrame(frame); frame = 0; reset() }
      else schedule()
    }
    element.addEventListener('pointermove', move, { passive: true })
    element.addEventListener('pointerleave', leave)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    schedule()
    return () => {
      window.cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerleave', leave)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', visibility)
      reset()
    }
  }, [reduced])
  return root
}
