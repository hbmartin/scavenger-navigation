// Top-level hunt state machine (PRD §4), as a pure reducer — unit-testable off-device.
// INIT → PERMISSION_GATE → (BLOCKED ↔) READY → NAVIGATING ↔ ARRIVED → COMPLETE

import { defaultProgress, type Progress } from './progress'

export type Phase =
  | 'init'
  | 'permission-gate'
  | 'blocked'
  | 'ready'
  | 'navigating'
  | 'arrived'
  | 'complete'

export type BlockedReason = 'location' | 'compass'

export interface HuntState {
  phase: Phase
  blockedReason: BlockedReason
  progress: Progress
}

export type HuntEvent =
  | { type: 'RESTORE'; progress: Progress }
  | { type: 'PERMISSIONS_GRANTED' }
  | { type: 'PERMISSIONS_BLOCKED'; reason: BlockedReason }
  | { type: 'COMPASS_LOST' }
  | { type: 'START' }
  | { type: 'ARRIVED'; stopId: string }
  | { type: 'NEXT' }

export function initialHuntState(huntId: string): HuntState {
  return {
    phase: 'init',
    blockedReason: 'location',
    progress: defaultProgress(huntId),
  }
}

function clampProgress(progress: Progress, stopCount: number): Progress {
  const lastStopIndex = Math.max(0, stopCount - 1)
  const currentIndex = Math.min(progress.currentIndex, lastStopIndex)
  return currentIndex === progress.currentIndex ? progress : { ...progress, currentIndex }
}

/**
 * Build the reducer for a hunt with `stopCount` stops.
 * Events that are illegal in the current phase are ignored (state returned unchanged).
 */
export function makeHuntReducer(stopCount: number) {
  return function huntReducer(state: HuntState, event: HuntEvent): HuntState {
    switch (event.type) {
      case 'RESTORE': {
        if (state.phase !== 'init') return state
        const progress = clampProgress(event.progress, stopCount)
        return {
          ...state,
          progress,
          phase: progress.finished ? 'complete' : 'permission-gate',
        }
      }

      case 'PERMISSIONS_GRANTED': {
        if (state.phase !== 'permission-gate' && state.phase !== 'blocked') return state
        // Resume mid-hunt players directly at their current stop (PRD §6.9).
        return { ...state, phase: state.progress.started ? 'navigating' : 'ready' }
      }

      case 'PERMISSIONS_BLOCKED': {
        if (state.phase !== 'permission-gate' && state.phase !== 'blocked') return state
        return { ...state, phase: 'blocked', blockedReason: event.reason }
      }

      case 'COMPASS_LOST': {
        // Android compass can turn out unavailable after "granted" (no absolute events).
        if (state.phase !== 'ready' && state.phase !== 'navigating') return state
        return { ...state, phase: 'blocked', blockedReason: 'compass' }
      }

      case 'START': {
        if (state.phase !== 'ready') return state
        return {
          ...state,
          phase: 'navigating',
          progress: { ...state.progress, started: true },
        }
      }

      case 'ARRIVED': {
        if (state.phase !== 'navigating') return state
        const completed = state.progress.completedStopIds.includes(event.stopId)
          ? state.progress.completedStopIds
          : [...state.progress.completedStopIds, event.stopId]
        return {
          ...state,
          phase: 'arrived',
          progress: { ...state.progress, completedStopIds: completed },
        }
      }

      case 'NEXT': {
        if (state.phase !== 'arrived') return state
        const isLast = state.progress.currentIndex >= stopCount - 1
        if (isLast) {
          return {
            ...state,
            phase: 'complete',
            progress: { ...state.progress, finished: true },
          }
        }
        return {
          ...state,
          phase: 'navigating',
          progress: { ...state.progress, currentIndex: state.progress.currentIndex + 1 },
        }
      }
    }
  }
}
