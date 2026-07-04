import { describe, expect, it } from 'vitest'
import { getStopSlug } from './hunt-data'

describe('getStopSlug', () => {
  it('lowercases and hyphenates spacing', () => {
    expect(getStopSlug({ name: '  Test Stop Name  ' })).toBe('test-stop-name')
  })

  it('collapses punctuation into a single separator', () => {
    expect(getStopSlug({ name: 'Hollywood Sign (Lake Hollywood Park)' })).toBe(
      'hollywood-sign-lake-hollywood-park',
    )
  })

  it('strips accents before slugging', () => {
    expect(getStopSlug({ name: 'Café Déjà Vu' })).toBe('cafe-deja-vu')
  })
})
