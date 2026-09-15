import { describe, expect, it, vi } from 'vitest'
import { createPippinBlinkController, nextBlinkDelay } from './pippinMotion'

describe('Pippin natural blink lifecycle', () => {
  it('keeps each blink pause within a calm, non-robotic range', () => {
    expect(nextBlinkDelay(() => 0)).toBe(2600)
    expect(nextBlinkDelay(() => 1)).toBe(6200)
  })

  it('occasionally schedules a double blink and resumes after visibility returns', () => {
    const timers = []
    const schedule = vi.fn((callback, delay) => { timers.push({ callback, delay }); return timers.length })
    const cancel = vi.fn()
    const blink = vi.fn()
    const controller = createPippinBlinkController({ random: () => 0.01, schedule, cancel, blink })

    controller.start()
    expect(timers[0].delay).toBe(2636)
    timers.shift().callback()
    expect(blink).toHaveBeenCalledWith('closed')
    expect(timers[0].delay).toBe(115)
    timers.shift().callback()
    expect(blink).toHaveBeenCalledWith('open')
    expect(timers[0].delay).toBe(145)

    controller.pause()
    expect(cancel).toHaveBeenCalled()
    controller.start()
    expect(schedule).toHaveBeenCalledTimes(4)
  })
})
