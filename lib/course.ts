import { bearingDegrees, haversineMeters, normalize360 } from './geo'

export type CourseConfidence = 'low' | 'medium' | 'high'
export type CourseSource = 'native' | 'derived'

export interface CoursePoint {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export interface CourseEstimate {
  heading: number
  speed: number
  source: CourseSource
  confidence: CourseConfidence
}

export const MIN_COURSE_SPEED_MPS = 0.8
const MIN_COURSE_SIGNAL_SPEED_MPS = 0.35
const HIGH_CONFIDENCE_ACCURACY_M = 15
const MEDIUM_CONFIDENCE_ACCURACY_M = 30
const MAX_COURSE_ACCURACY_M = 40
const MIN_DERIVED_COURSE_DISTANCE_M = 6
const DERIVED_DISTANCE_ACCURACY_MULTIPLIER = 0.75
// A base point older than this can't give a meaningful average speed: after a
// stationary pause, distance/elapsed dilutes toward zero and suppresses the
// course long after walking resumes. The watcher re-bases at this age, and the
// estimator rejects anything older (belt for callers that don't re-base).
export const MAX_COURSE_BASE_AGE_MS = 15000
const MAX_DERIVED_COURSE_WINDOW_S = 20

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function courseConfidence(
  speed: number | null | undefined,
  accuracy: number,
): CourseConfidence | null {
  if (!finiteNumber(speed) || speed < MIN_COURSE_SIGNAL_SPEED_MPS) return null
  if (!Number.isFinite(accuracy) || accuracy > MAX_COURSE_ACCURACY_M) return null
  if (speed >= MIN_COURSE_SPEED_MPS && accuracy <= HIGH_CONFIDENCE_ACCURACY_M) return 'high'
  if (speed >= MIN_COURSE_SPEED_MPS && accuracy <= MEDIUM_CONFIDENCE_ACCURACY_M) {
    return 'medium'
  }
  return 'low'
}

export function nativeCourseEstimate(
  heading: number | null | undefined,
  speed: number | null | undefined,
  accuracy: number,
): CourseEstimate | null {
  if (!finiteNumber(heading)) return null
  const confidence = courseConfidence(speed, accuracy)
  if (confidence === null || confidence === 'low' || !finiteNumber(speed)) return null
  return {
    heading: normalize360(heading),
    speed,
    source: 'native',
    confidence,
  }
}

export function derivedCourseEstimate(
  prev: CoursePoint | null,
  next: CoursePoint,
): CourseEstimate | null {
  if (!prev) return null

  const elapsedSeconds = (next.timestamp - prev.timestamp) / 1000
  if (elapsedSeconds <= 0 || elapsedSeconds > MAX_DERIVED_COURSE_WINDOW_S) return null

  const distance = haversineMeters(prev.lat, prev.lng, next.lat, next.lng)
  const accuracy = Math.max(prev.accuracy, next.accuracy)
  const minimumDistance = Math.max(
    MIN_DERIVED_COURSE_DISTANCE_M,
    accuracy * DERIVED_DISTANCE_ACCURACY_MULTIPLIER,
  )
  if (distance < minimumDistance) return null

  const speed = distance / elapsedSeconds
  const confidence = courseConfidence(speed, accuracy)
  if (confidence === null) return null

  return {
    heading: bearingDegrees(prev.lat, prev.lng, next.lat, next.lng),
    speed,
    source: 'derived',
    confidence,
  }
}
