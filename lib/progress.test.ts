import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultProgress, loadProgress, saveProgress, type Progress } from './progress'

const KEY = 'scavenger-progress'
const HUNT_ID = 'test-hunt-v1'

function makeLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    _store: store,
  }
}

let storage: ReturnType<typeof makeLocalStorage>

beforeEach(() => {
  storage = makeLocalStorage()
  vi.stubGlobal('window', { localStorage: storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadProgress', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
  })

  it('round-trips saved progress', () => {
    const progress: Progress = {
      huntId: HUNT_ID,
      started: true,
      currentIndex: 2,
      completedStopSlugs: ['a', 'b'],
      finished: false,
    }
    saveProgress(progress)
    expect(loadProgress(HUNT_ID)).toEqual(progress)
  })

  it('discards progress from a different hunt', () => {
    saveProgress({ ...defaultProgress('other-hunt'), started: true })
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
  })

  it('returns defaults on corrupt JSON', () => {
    storage.setItem(KEY, '{not json')
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
  })

  it('returns defaults on non-object payloads', () => {
    storage.setItem(KEY, JSON.stringify('hello'))
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
    storage.setItem(KEY, JSON.stringify(42))
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
  })

  it('fills in missing fields from defaults', () => {
    storage.setItem(KEY, JSON.stringify({ huntId: HUNT_ID, started: true }))
    expect(loadProgress(HUNT_ID)).toEqual({ ...defaultProgress(HUNT_ID), started: true })
  })

  it('drops legacy completed stop ids while preserving compatible progress fields', () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        huntId: HUNT_ID,
        started: true,
        currentIndex: 2,
        completedStopIds: ['old-explicit-id'],
        finished: true,
      }),
    )

    expect(loadProgress(HUNT_ID)).toEqual({
      ...defaultProgress(HUNT_ID),
      started: true,
      currentIndex: 2,
      finished: true,
    })
  })

  it('rejects wrong-typed fields wholesale', () => {
    storage.setItem(
      KEY,
      JSON.stringify({ ...defaultProgress(HUNT_ID), currentIndex: 'three' }),
    )
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))

    storage.setItem(
      KEY,
      JSON.stringify({ ...defaultProgress(HUNT_ID), completedStopSlugs: [1, 2] }),
    )
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))

    storage.setItem(KEY, JSON.stringify({ ...defaultProgress(HUNT_ID), started: 'yes' }))
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
  })

  it('rejects negative or fractional stop indices', () => {
    storage.setItem(KEY, JSON.stringify({ ...defaultProgress(HUNT_ID), currentIndex: -1 }))
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))

    storage.setItem(KEY, JSON.stringify({ ...defaultProgress(HUNT_ID), currentIndex: 1.5 }))
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
  })

  it('degrades to defaults when storage throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied')
        },
      },
    })
    expect(loadProgress(HUNT_ID)).toEqual(defaultProgress(HUNT_ID))
  })
})

describe('saveProgress', () => {
  it('swallows storage write failures', () => {
    vi.stubGlobal('window', {
      localStorage: {
        setItem: () => {
          throw new Error('quota exceeded')
        },
      },
    })
    expect(() => saveProgress(defaultProgress(HUNT_ID))).not.toThrow()
  })
})
