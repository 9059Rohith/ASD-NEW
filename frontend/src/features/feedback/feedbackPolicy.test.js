import { describe, expect, it } from 'vitest'
import { FEEDBACK_TIERS, getFeedbackProfile } from './feedbackPolicy'

describe('pronunciation feedback policy', () => {
  it.each([
    [0, 'sprout'], [20, 'sprout'], [21, 'bloom'], [40, 'bloom'],
    [41, 'shine'], [60, 'shine'], [61, 'star'], [80, 'star'],
    [81, 'gold'], [94, 'gold'], [95, 'ultimate'], [100, 'ultimate'],
  ])('maps %s accuracy to the %s tier', (accuracy, tier) => {
    expect(getFeedbackProfile(accuracy).id).toBe(tier)
  })

  it('clamps malformed scores and keeps every attempt positive and rewarded', () => {
    for (const value of [-10, Number.NaN, 0, 37, 72, 200]) {
      const profile = getFeedbackProfile(value)
      expect(profile.heading).not.toMatch(/wrong|poor|failed|bad/i)
      expect(profile.message).toBeTruthy()
      expect(profile.stars).toBeGreaterThanOrEqual(1)
      expect(profile.coins).toBeGreaterThan(0)
      expect(profile.effects.length).toBeGreaterThan(0)
    }
  })

  it('increases rewards and celebration richness without decreasing', () => {
    const profiles = [0, 21, 41, 61, 81, 95].map((score) => getFeedbackProfile(score))
    expect(profiles.map((profile) => profile.coins)).toEqual([2, 4, 6, 8, 10, 15])
    expect(profiles.map((profile) => profile.stars)).toEqual([1, 1, 2, 2, 3, 3])
    profiles.slice(1).forEach((profile, index) => {
      expect(profile.effects.length).toBeGreaterThanOrEqual(profiles[index].effects.length)
    })
  })

  it('defines six complete tiers with gentle sound cues and animal actions', () => {
    expect(FEEDBACK_TIERS).toHaveLength(6)
    for (const tier of FEEDBACK_TIERS) {
      expect(tier.messages.length).toBeGreaterThanOrEqual(3)
      expect(tier.sound).toMatch(/sparkle|bubble|chime|clap|bell|victory/)
      expect(tier.animalAction).toMatch(/wave|bounce|jump|dance|clap|celebrate/)
    }
  })
})
