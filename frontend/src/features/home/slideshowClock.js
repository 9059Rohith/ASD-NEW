export const HOME_SLIDE_INTERVAL = 8000

// One timeout per visible slide. A pause discards its remainder so returning
// visitors always get a complete reading interval, never a surprise advance.
export function createSlideshowClock(advance, timers = globalThis, delay = HOME_SLIDE_INTERVAL) {
  let timer = null
  return {
    update(running) {
      if (timer !== null) timers.clearTimeout(timer)
      timer = running ? timers.setTimeout(() => { timer = null; advance() }, delay) : null
    },
    dispose() { if (timer !== null) timers.clearTimeout(timer); timer = null },
  }
}
