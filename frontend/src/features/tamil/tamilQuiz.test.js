import { describe, expect, it } from 'vitest'
import { tamilQuizOptions, tamilQuizPrompt } from './tamilQuiz'

const items = [
  { id: 'uyirmei-ka-a', kind: 'uyirmei', consonant_id: 'consonant-ka', text: 'க', transliteration: 'ka' },
  { id: 'uyirmei-ka-aa', kind: 'uyirmei', consonant_id: 'consonant-ka', text: 'கா', transliteration: 'kaa' },
  { id: 'uyirmei-ka-i', kind: 'uyirmei', consonant_id: 'consonant-ka', text: 'கி', transliteration: 'ki' },
  { id: 'uyirmei-ka-ii', kind: 'uyirmei', consonant_id: 'consonant-ka', text: 'கீ', transliteration: 'kii' },
  { id: 'uyirmei-nga-a', kind: 'uyirmei', consonant_id: 'consonant-nga', text: 'ங', transliteration: 'nga' },
]

describe('Tamil recognition questions', () => {
  it('uses real peers of the same kind and consonant family', () => {
    expect(tamilQuizOptions(items[1], items).map(option => option.id)).toEqual([
      'uyirmei-ka-a', 'uyirmei-ka-aa', 'uyirmei-ka-i', 'uyirmei-ka-ii',
    ])
  })
  it('forms an identifiable prompt from the content type', () => {
    expect(tamilQuizPrompt({ kind: 'word', meaning: 'Mother' })).toContain('Mother')
    expect(tamilQuizPrompt({ kind: 'consonant', transliteration: 'k' })).toContain('k')
  })
})
