import { describe, expect, it } from 'vitest'
import { buildTrainingRoadmap } from './trainingCurriculum'

describe('training curriculum roadmap', () => {
  it('keeps all 12 vowels and four words ordered and directly available', () => {
    const lessons = ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 'அம்மா', 'அப்பா', 'மரம்', 'பழம்']
      .map((symbol, index) => ({ id: index + 1, symbol, english: `L${index + 1}` }))

    const roadmap = buildTrainingRoadmap(lessons)

    expect(roadmap.map((lesson) => lesson.symbol)).toEqual([
      'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ',
      'அம்மா', 'அப்பா', 'மரம்', 'பழம்',
    ])
    expect(roadmap.every((lesson) => lesson.status === 'available')).toBe(true)
    expect(roadmap.map((lesson) => lesson.path)).toEqual(
      Array.from({ length: 16 }, (_, index) => `/therapy/${index + 1}`),
    )
  })

  it('drops malformed records instead of creating broken lesson links', () => {
    expect(buildTrainingRoadmap([null, { id: 0, symbol: 'அ' }, { id: 2, symbol: '' }])).toEqual([])
  })
})
