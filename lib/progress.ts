// localStorage progress persistence (PRD §6.9).

import { z } from 'zod'

export const ProgressSchema = z.object({
  huntId: z.string(),
  started: z.boolean(),
  currentIndex: z.number().int().min(0), // index into hunt.stops
  completedStopSlugs: z.array(z.string()),
  finished: z.boolean(),
})

export type Progress = z.infer<typeof ProgressSchema>

const KEY = 'scavenger-progress'

export function defaultProgress(huntId: string): Progress {
  return {
    huntId,
    started: false,
    currentIndex: 0,
    completedStopSlugs: [],
    finished: false,
  }
}

export function loadProgress(huntId: string): Progress {
  if (typeof window === 'undefined') return defaultProgress(huntId)
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return defaultProgress(huntId)
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaultProgress(huntId)
    // Missing fields fall back to defaults; wrong-typed fields reject the whole record.
    const validated = ProgressSchema.safeParse({ ...defaultProgress(huntId), ...parsed })
    if (!validated.success) return defaultProgress(huntId)
    // Discard progress from a different/older hunt definition.
    if (validated.data.huntId !== huntId) return defaultProgress(huntId)
    return validated.data
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
