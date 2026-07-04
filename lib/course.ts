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
  // Seconds of history the heading averages over: 0 for native (the platform
  // reports the instantaneous course), the base-to-fix elapsed time for
  // derived chords. Long windows can embed a turn made many seconds ago.
  windowSeconds: number
}

export const MIN_COURSE_SPEED_MPS = 0.8
const MIN_COURSE_SIGNAL_SPEED_MPS = 0.35
const HIGH_CONFIDENCE_ACCURACY_M = 15
const MEDIUM_CONFIDENCE_ACCURACY_M = 30
const MAX_COURSE_ACCURACY_M = 40
const MIN_DERIVED_COURSE_DISTANCE_M = 6
const DERIVED_DISTANCE_ACCURACY_MULTIPLIER = 0.75
// Derived-course windowing. A window longer than this averages too much
// history to describe where the user is heading NOW, so the estimator rejects
// it. 30 s is sized so the slowest usable pace (MIN_COURSE_SPEED_MPS) still
// covers the minimum distance at the worst medium-confidence accuracy
// (0.75 × 30 m = 22.5 m at 0.8 m/s ≈ 28 s) before the window closes.
export const MAX_DERIVED_COURSE_WINDOW_MS = 30_000
// Age below which an otherwise usable base is kept: gives distance time to
// accrue past the accuracy noise floor before any stationary judgment is made.
const STATIONARY_REBASE_AGE_MS = 15_000

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
    windowSeconds: 0,
  }
}

/**
 * Should the derived-course base re-anchor onto the current point? True when
 * the window is too old to describe the present, when the base accuracy is too
 * poor for the estimator to ever accept, or when the user has sat on this base
 * past the stationary grace period without accruing distance at a pace the
 * estimator could ever accept — a pause would otherwise dilute distance/elapsed
 * and suppress the course long after walking resumes. A merely old base that
 * IS accruing distance survives, so slow walkers still get a course once they
 * cover the minimum distance.
 */
export function courseBaseExpired(base: CoursePoint, next: CoursePoint): boolean {
  const elapsedMs = next.timestamp - base.timestamp
  if (elapsedMs <= 0) return true
  if (elapsedMs > MAX_DERIVED_COURSE_WINDOW_MS) return true
  if (courseConfidence(MIN_COURSE_SPEED_MPS, base.accuracy) === null) return true
  if (elapsedMs <= STATIONARY_REBASE_AGE_MS) return false
  // "A pace/accuracy the estimator could ever accept" is the estimator's own
  // gate — delegate so the two can't drift apart.
  const distance = haversineMeters(base.lat, base.lng, next.lat, next.lng)
  return courseConfidence(distance / (elapsedMs / 1000), base.accuracy) === null
}

export function derivedCourseEstimate(
  prev: CoursePoint | null,
  next: CoursePoint,
): CourseEstimate | null {
  if (!prev) return null

  const elapsedMs = next.timestamp - prev.timestamp
  if (elapsedMs <= 0 || elapsedMs > MAX_DERIVED_COURSE_WINDOW_MS) return null
  const elapsedSeconds = elapsedMs / 1000

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
    windowSeconds: elapsedSeconds,
  }
}
