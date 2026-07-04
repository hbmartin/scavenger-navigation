// localStorage progress persistence (PRD §6.9).

export interface Progress {
  huntId: string
  started: boolean
  currentIndex: number // index into hunt.stops
  completedStopIds: string[]
  finished: boolean
}

const KEY = 'scavenger-progress'

export function defaultProgress(huntId: string): Progress {
  return {
    huntId,
    started: false,
    currentIndex: 0,
    completedStopIds: [],
    finished: false,
  }
}

export function loadProgress(huntId: string): Progress {
  if (typeof window === 'undefined') return defaultProgress(huntId)
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return defaultProgress(huntId)
    const parsed = JSON.parse(raw) as Progress
    // Discard progress from a different/older hunt definition.
    if (parsed.huntId !== huntId) return defaultProgress(huntId)
    return {
      ...defaultProgress(huntId),
      ...parsed,
    }
  } catch {
    return defaultProgress(huntId)
  }
}

export function saveProgress(progress: Progress): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // Storage unavailable (private mode quota, etc.) — degrade to in-memory.
  }
}
