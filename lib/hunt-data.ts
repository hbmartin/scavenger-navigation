// Hardcoded hunt data. Edit this file to change the hunt (PRD §5).
// The order of Hunt.stops defines the hunt sequence.
// Stops below are sample LA landmarks — swap in your real coordinates.

export interface Stop {
  name: string // revealed only on arrival
  lat: number
  lng: number
  hint?: string // optional navigation hint
  photoUrl?: string // optional arrival photo
  description?: string // optional arrival description
  radiusMeters?: number // optional per-stop override
}

export interface Hunt {
  id: string
  title: string
  arrivalRadiusMeters: number
  stops: Stop[]
}

export function getStopSlug(stop: Pick<Stop, 'name'>): string {
  return stop.name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const HUNT: Hunt = {
  id: 'melrose-art-hunt-v1',
  title: 'The Melrose Art Hunt',
  arrivalRadiusMeters: 12,
  stops: [
    {
      name: 'Test1',
      lat: 34.06096793684116,
      lng: -118.38029366026275,
    },
    {
      name: 'Test 2',
      lat: 34.0650240483478,
      lng: -118.38043573712486,
      photoUrl: '/stops/echo-park-lake.png',
    },
    {
      name: 'Test 3',
      lat: 34.06501499474376,
      lng: -118.37842480263997,
      photoUrl: '/stops/venice-canals.png',
    }
  ],
}

// ---- Tuning constants (PRD §6.6, §11, §12) ----

/** Consecutive in-radius fixes required before completing a stop. */
export const DEBOUNCE_FIX_COUNT = 3

/**
 * Trust a sub-radius fix only when reported accuracy ≤ multiplier × radius.
 * iOS accuracy is quantized and jumpy; loosen toward 2× (or higher) if the
 * geofence rarely fires outdoors (PRD §12).
 */
export const ACCURACY_GATE_MULTIPLIER = 1.5

/** LA magnetic declination — applied on Android when heading is magnetic (PRD §7.4). */
export const DECLINATION_DEG = 11.5

/** Exponential smoothing alphas. */
export const DISTANCE_SMOOTHING_ALPHA = 0.35
export const HEADING_SMOOTHING_ALPHA = 0.3
