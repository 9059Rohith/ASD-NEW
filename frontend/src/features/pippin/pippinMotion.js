export function nextBlinkDelay(random = Math.random) {
  return Math.round(2600 + Math.max(0, Math.min(1, random())) * 3600)
}

export function createPippinBlinkController({
  random = Math.random,
  schedule = (callback, delay) => window.setTimeout(callback, delay),
  cancel = timer => window.clearTimeout(timer),
  blink,
}) {
  let timer = null
  let running = false

  const later = (callback, delay) => {
    timer = schedule(callback, delay)
  }
  const queueBlink = () => later(closeEyes, nextBlinkDelay(random))
  const finishBlink = () => {
    blink('open')
    queueBlink()
  }
  const closeAgain = () => {
    blink('closed')
    later(finishBlink, 105)
  }
  const openEyes = () => {
    blink('open')
    if (random() < 0.12) later(closeAgain, 145)
    else queueBlink()
  }
  const closeEyes = () => {
    if (!running) return
    blink('closed')
    later(openEyes, 115)
  }

  return {
    start() {
      if (running) return
      running = true
      blink('open')
      queueBlink()
    },
    pause() {
      running = false
      if (timer !== null) cancel(timer)
      timer = null
      blink('open')
    },
  }
}
