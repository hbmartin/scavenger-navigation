import { describe, expect, it } from 'vitest'
import {
  advanceArrival,
  approachProgress,
  heatLevel,
  INITIAL_ARRIVAL_STATE,
  manualMarkNeedsConfirmation,
  type ArrivalState,
} from './arrival'
import { DEBOUNCE_FIX_COUNT } from './hunt-data'

const RADIUS = 25

function feed(
  state: ArrivalState,
  fixes: Array<{ distance: number; accuracy?: number }>,
): ArrivalState {
  return fixes.reduce(
    (s, f) =>
      advanceArrival(s, {
        rawDistanceMeters: f.distance,
        accuracyMeters: f.accuracy ?? 10,
        radiusMeters: RADIUS,
      }),
    state,
  )
}

describe('advanceArrival', () => {
  it('passes the first distance through unsmoothed and records it as the start', () => {
    const s = feed(INITIAL_ARRIVAL_STATE, [{ distance: 500 }])
    expect(s.smoothedDistance).toBe(500)
    expect(s.startDistance).toBe(500)
    expect(s.arrived).toBe(false)
  })

  it('smooths subsequent distances toward the raw value', () => {
    const s = feed(INITIAL_ARRIVAL_STATE, [{ distance: 100 }, { distance: 0 }])
    expect(s.smoothedDistance).toBeGreaterThan(0)
    expect(s.smoothedDistance).toBeLessThan(100)
    // Start reference stays pinned to the first fix.
    expect(s.startDistance).toBe(100)
  })

  it(`arrives after ${DEBOUNCE_FIX_COUNT} consecutive trusted in-radius fixes`, () => {
    const inRadius = { distance: 5, accuracy: 10 }
    const almost = feed(INITIAL_ARRIVAL_STATE, Array(DEBOUNCE_FIX_COUNT - 1).fill(inRadius))
    expect(almost.arrived).toBe(false)
    const done = feed(almost, [inRadius])
    expect(done.arrived).toBe(true)
  })

  it('resets the debounce counter when a fix leaves the radius', () => {
    const s = feed(INITIAL_ARRIVAL_STATE, [
      { distance: 5 },
      { distance: 5 },
      { distance: 500 }, // GPS jump — smoothed distance leaves the radius
      { distance: 5 },
      { distance: 5 },
    ])
    expect(s.arrived).toBe(false)
    expect(s.inRadiusCount).toBeLessThan(DEBOUNCE_FIX_COUNT)
  })

  it('does not count in-radius fixes with poor reported accuracy', () => {
    // Accuracy gate: accuracy must be ≤ 1.5 × radius (37.5 m here).
    const s = feed(
      INITIAL_ARRIVAL_STATE,
      Array(10).fill({ distance: 5, accuracy: 100 }),
    )
    expect(s.arrived).toBe(false)
    expect(s.inRadiusCount).toBe(0)
  })

  it('latches once arrived and ignores later fixes', () => {
    const arrived = feed(INITIAL_ARRIVAL_STATE, Array(DEBOUNCE_FIX_COUNT).fill({ distance: 5 }))
    expect(arrived.arrived).toBe(true)
    const after = feed(arrived, [{ distance: 5000 }])
    expect(after).toBe(arrived)
  })
})

describe('heatLevel', () => {
  it('maps distances to tiers', () => {
    expect(heatLevel(2000, RADIUS)).toBe('cold')
    expect(heatLevel(300, RADIUS)).toBe('warm')
    expect(heatLevel(100, RADIUS)).toBe('hot')
    expect(heatLevel(45, RADIUS)).toBe('burning')
    expect(heatLevel(0, RADIUS)).toBe('burning')
  })

  it('scales the burning tier with large radii', () => {
    expect(heatLevel(150, 100)).toBe('burning')
  })
})

describe('approachProgress', () => {
  it('is 0 before a start reference exists', () => {
    expect(approachProgress(null, 100)).toBe(0)
    expect(approachProgress(100, null)).toBe(0)
  })
  it('grows toward 1 as distance shrinks', () => {
    expect(approachProgress(1000, 1000)).toBe(0)
    expect(approachProgress(1000, 500)).toBe(0.5)
    expect(approachProgress(1000, 0)).toBe(1)
  })
  it('clamps when the player walks away from the start', () => {
    expect(approachProgress(1000, 2000)).toBe(0)
  })
})

describe('manualMarkNeedsConfirmation', () => {
  it('requires confirmation with no fix', () => {
    expect(manualMarkNeedsConfirmation(null, RADIUS)).toBe(true)
  })
  it('requires confirmation when clearly outside 2× radius', () => {
    expect(manualMarkNeedsConfirmation(51, RADIUS)).toBe(true)
  })
  it('skips confirmation when plausibly at the stop', () => {
    expect(manualMarkNeedsConfirmation(50, RADIUS)).toBe(false)
    expect(manualMarkNeedsConfirmation(10, RADIUS)).toBe(false)
  })
})
