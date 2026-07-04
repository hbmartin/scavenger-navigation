// Pure arrival/geofence logic (PRD §6.3, §6.6) — extracted from the
// navigation screen so the safety-critical parts are unit-testable.

import {
  ACCURACY_GATE_MULTIPLIER,
  DEBOUNCE_FIX_COUNT,
  DISTANCE_SMOOTHING_ALPHA,
} from './hunt-data'
import { smoothScalar } from './geo'

export interface ArrivalState {
  /** Exponentially smoothed distance to the target, meters. */
  smoothedDistance: number | null
  /** First smoothed distance seen for this stop — reference for the approach ring. */
  startDistance: number | null
  /** Consecutive trusted in-radius fixes so far. */
  inRadiusCount: number
  /** Latched true once the geofence fires; never un-fires for the same stop. */
  arrived: boolean
}

export const INITIAL_ARRIVAL_STATE: ArrivalState = {
  smoothedDistance: null,
  startDistance: null,
  inRadiusCount: 0,
  arrived: false,
}

export interface ArrivalInput {
  rawDistanceMeters: number
  accuracyMeters: number
  radiusMeters: number
}

/**
 * Fold one GPS fix into the arrival state: smooth the distance, gate on
 * reported accuracy, and debounce the geofence over consecutive fixes.
 */
export function advanceArrival(state: ArrivalState, input: ArrivalInput): ArrivalState {
  if (state.arrived) return state

  const smoothed = smoothScalar(
    state.smoothedDistance,
    input.rawDistanceMeters,
    DISTANCE_SMOOTHING_ALPHA,
  )
  const startDistance = state.startDistance ?? smoothed

  const accuracyOk = input.accuracyMeters <= ACCURACY_GATE_MULTIPLIER * input.radiusMeters
  const inRadius = smoothed <= input.radiusMeters && accuracyOk
  const inRadiusCount = inRadius ? state.inRadiusCount + 1 : 0

  return {
    smoothedDistance: smoothed,
    startDistance,
    inRadiusCount,
    arrived: inRadiusCount >= DEBOUNCE_FIX_COUNT,
  }
}

// ---- Hot/cold signal (PRD §6.4 polish) ----

export type HeatLevel = 'cold' | 'warm' | 'hot' | 'burning'

/** Distance → hot/cold tier. `burning` scales with the arrival radius so it always fires. */
export function heatLevel(distanceMeters: number, radiusMeters: number): HeatLevel {
  if (distanceMeters <= Math.max(2 * radiusMeters, 50)) return 'burning'
  if (distanceMeters <= 120) return 'hot'
  if (distanceMeters <= 400) return 'warm'
  return 'cold'
}

/**
 * Fraction of the approach completed, in [0, 1], relative to where the
 * player first started navigating toward this stop.
 */
export function approachProgress(
  startDistance: number | null,
  currentDistance: number | null,
): number {
  if (startDistance === null || currentDistance === null || startDistance <= 0) return 0
  return Math.min(1, Math.max(0, 1 - currentDistance / startDistance))
}

// ---- Stale-fix detection (PRD §6.5 hardening) ----
// The staleness predicate itself lives in lib/timestamp-expiry.ts; the
// navigation screen's watchdog applies it with this age.

/** A fix older than this is treated as "GPS signal lost". */
export const STALE_FIX_MS = 15000

// ---- "Mark found" guardrail (PRD §6.8 hardening) ----

/**
 * Manual "Mark found" needs an extra confirmation when we can't corroborate
 * the player is at least near the stop (no fix, or clearly outside 2× radius).
 */
export function manualMarkNeedsConfirmation(
  smoothedDistance: number | null,
  radiusMeters: number,
): boolean {
  return smoothedDistance === null || smoothedDistance > 2 * radiusMeters
}
