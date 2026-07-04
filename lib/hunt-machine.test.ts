import { describe, expect, it } from 'vitest'
import {
  initialHuntState,
  makeHuntReducer,
  type HuntEvent,
  type HuntState,
} from './hunt-machine'
import { defaultProgress } from './progress'

const STOP_COUNT = 3
const reducer = makeHuntReducer(STOP_COUNT)

function run(state: HuntState, events: HuntEvent[]): HuntState {
  return events.reduce(reducer, state)
}

describe('hunt machine', () => {
  it('starts in init', () => {
    expect(initialHuntState('h1').phase).toBe('init')
  })

  it('RESTORE routes fresh progress to the permission gate', () => {
    const s = reducer(initialHuntState('h1'), { type: 'RESTORE', progress: defaultProgress('h1') })
    expect(s.phase).toBe('permission-gate')
  })

  it('RESTORE routes finished progress straight to complete', () => {
    const s = reducer(initialHuntState('h1'), {
      type: 'RESTORE',
      progress: { ...defaultProgress('h1'), started: true, finished: true },
    })
    expect(s.phase).toBe('complete')
  })

  it('RESTORE clamps out-of-range currentIndex to the last stop', () => {
    const s = reducer(initialHuntState('h1'), {
      type: 'RESTORE',
      progress: { ...defaultProgress('h1'), started: true, currentIndex: 99 },
    })
    expect(s.phase).toBe('permission-gate')
    expect(s.progress.currentIndex).toBe(STOP_COUNT - 1)
  })

  it('RESTORE clamps negative currentIndex to zero', () => {
    const s = reducer(initialHuntState('h1'), {
      type: 'RESTORE',
      progress: { ...defaultProgress('h1'), started: true, currentIndex: -5 },
    })
    expect(s.phase).toBe('permission-gate')
    expect(s.progress.currentIndex).toBe(0)
  })

  it('walks the full happy path through every stop', () => {
    let s = run(initialHuntState('h1'), [
      { type: 'RESTORE', progress: defaultProgress('h1') },
      { type: 'PERMISSIONS_GRANTED' },
    ])
    expect(s.phase).toBe('ready')

    s = reducer(s, { type: 'START' })
    expect(s.phase).toBe('navigating')
    expect(s.progress.started).toBe(true)

    for (let i = 0; i < STOP_COUNT; i++) {
      expect(s.progress.currentIndex).toBe(i)
      s = reducer(s, { type: 'ARRIVED', stopSlug: `stop-${i}` })
      expect(s.phase).toBe('arrived')
      expect(s.progress.completedStopSlugs).toContain(`stop-${i}`)
      s = reducer(s, { type: 'NEXT' })
    }

    expect(s.phase).toBe('complete')
    expect(s.progress.finished).toBe(true)
    expect(s.progress.completedStopSlugs).toHaveLength(STOP_COUNT)
  })

  it('permission denial blocks, and a later grant resumes', () => {
    let s = run(initialHuntState('h1'), [
      { type: 'RESTORE', progress: defaultProgress('h1') },
      { type: 'PERMISSIONS_BLOCKED', reason: 'compass' },
    ])
    expect(s.phase).toBe('blocked')
    expect(s.blockedReason).toBe('compass')

    s = reducer(s, { type: 'PERMISSIONS_GRANTED' })
    expect(s.phase).toBe('ready')
  })

  it('resumes mid-hunt players directly at navigating after permissions', () => {
    const s = run(initialHuntState('h1'), [
      {
        type: 'RESTORE',
        progress: { ...defaultProgress('h1'), started: true, currentIndex: 1 },
      },
      { type: 'PERMISSIONS_GRANTED' },
    ])
    expect(s.phase).toBe('navigating')
    expect(s.progress.currentIndex).toBe(1)
  })

  it('COMPASS_LOST blocks from ready and navigating, but not elsewhere', () => {
    const ready = run(initialHuntState('h1'), [
      { type: 'RESTORE', progress: defaultProgress('h1') },
      { type: 'PERMISSIONS_GRANTED' },
    ])
    expect(reducer(ready, { type: 'COMPASS_LOST' }).phase).toBe('blocked')
    expect(reducer(ready, { type: 'COMPASS_LOST' }).blockedReason).toBe('compass')

    const complete = reducer(initialHuntState('h1'), {
      type: 'RESTORE',
      progress: { ...defaultProgress('h1'), finished: true },
    })
    expect(reducer(complete, { type: 'COMPASS_LOST' })).toBe(complete)
  })

  it('does not duplicate an already-completed stop slug', () => {
    const s = run(initialHuntState('h1'), [
      { type: 'RESTORE', progress: { ...defaultProgress('h1'), completedStopSlugs: ['stop-0'] } },
      { type: 'PERMISSIONS_GRANTED' },
      { type: 'START' },
      { type: 'ARRIVED', stopSlug: 'stop-0' },
    ])
    expect(s.progress.completedStopSlugs).toEqual(['stop-0'])
  })

  it('ignores illegal events for the current phase', () => {
    const gate = reducer(initialHuntState('h1'), {
      type: 'RESTORE',
      progress: defaultProgress('h1'),
    })
    expect(reducer(gate, { type: 'START' })).toBe(gate)
    expect(reducer(gate, { type: 'ARRIVED', stopSlug: 'x' })).toBe(gate)
    expect(reducer(gate, { type: 'NEXT' })).toBe(gate)
    // A second RESTORE after leaving init is a no-op.
    expect(reducer(gate, { type: 'RESTORE', progress: defaultProgress('h2') })).toBe(gate)
  })
})
