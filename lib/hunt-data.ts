// Hardcoded hunt data. Edit this file to change the hunt (PRD §5).
// The order of Hunt.stops defines the hunt sequence.
// Stops below are sample LA landmarks — swap in your real coordinates.

export interface Stop {
  id: string // stable, used for progress persistence
  name: string // revealed only on arrival
  lat: number
  lng: number
  photoUrl?: string // optional arrival photo
  radiusMeters?: number // optional per-stop override
}

export interface Hunt {
  id: string
  title: string
  arrivalRadiusMeters: number
  stops: Stop[]
}

export const HUNT: Hunt = {
  id: 'melrose-art-hunt-v1',
  title: 'The Melrose Art Hunt',
  arrivalRadiusMeters: 25,
  stops: [
    {
      id: 'griffith',
      name: 'Griffith Observatory',
      lat: 34.118434,
      lng: -118.300393,
      photoUrl: '/stops/griffith-observatory.png',
    },
    {
      id: 'hollywood-sign',
      name: 'Hollywood Sign (Lake Hollywood Park)',
      lat: 34.116856,
      lng: -118.339383,
      photoUrl: '/stops/hollywood-sign.png',
    },
    {
      id: 'echo-park',
      name: 'Echo Park Lake Fountain',
      lat: 34.072861,
      lng: -118.260495,
      photoUrl: '/stops/echo-park-lake.png',
    },
    {
      id: 'venice-canals',
      name: 'Venice Canals',
      lat: 33.983215,
      lng: -118.466171,
      photoUrl: '/stops/venice-canals.png',
    },
    {
      id: 'santa-monica-pier',
      name: 'Santa Monica Pier',
      lat: 34.008663,
      lng: -118.498646,
      photoUrl: '/stops/santa-monica-pier.png',
    },
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
