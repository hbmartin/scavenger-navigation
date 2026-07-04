import {
  normalize360,
  shortestAngleDelta,
  weightedCircularMeanDegrees,
} from './geo'
import type { CourseConfidence } from './course'

export type NavigationHeadingSource = 'compass' | 'gps-course' | 'blended'
export type HeadingConfidence = CourseConfidence

export interface NavigationHeadingChoice {
  heading: number | null
  source: NavigationHeadingSource | null
}

// iOS webkitCompassAccuracy tier boundaries (PRD §12).
export const IOS_MEDIUM_ACCURACY_DEG = 35
export const IOS_HIGH_ACCURACY_DEG = 18
const CONFIDENCE_HYSTERESIS_DEG = 4

// webkitCompassAccuracy jitters at event rate (~50Hz); accuracy dwelling on a
// tier boundary must not flip the confidence tier — and with it the whole
// navigation tree plus the BLEND_RULES weights — at sensor rate. Promotion
// happens at the nominal boundary; demotion only once accuracy clears it by
// the hysteresis margin. Only the exit gates widen: widening the entry gates
// instead would strand a steady mid-band accuracy (e.g. 15°, inside the old
// 14° entry gate) one tier below its nominal classification forever.
export function compassConfidenceFromAccuracy(
  accuracy: number | undefined,
  previous: HeadingConfidence,
): HeadingConfidence {
  if (typeof accuracy !== 'number' || accuracy < 0) return 'low'
  const highGate =
    previous === 'high'
      ? IOS_HIGH_ACCURACY_DEG + CONFIDENCE_HYSTERESIS_DEG
      : IOS_HIGH_ACCURACY_DEG
  const mediumGate =
    previous === 'low'
      ? IOS_MEDIUM_ACCURACY_DEG
      : IOS_MEDIUM_ACCURACY_DEG + CONFIDENCE_HYSTERESIS_DEG
  if (accuracy <= highGate) return 'high'
  if (accuracy <= mediumGate) return 'medium'
  return 'low'
}

export const MIN_BEARING_DISTANCE_METERS = 8
export const BEARING_ACCURACY_MULTIPLIER = 2
// Hysteresis band so GPS jitter near the threshold can't strobe the arrow:
// once hidden the bearing must clear the threshold with margin to come back;
// once shown it must fall clearly below to hide.
export const BEARING_SHOW_MULTIPLIER = 1.15
export const BEARING_HIDE_MULTIPLIER = 0.85
// A GPS course describes where the user WAS walking. Once no fresh fix has
// replaced it for this long, it must not override a live compass (e.g. the
// user stopped and turned in place while the platform stopped sending fixes).
export const MAX_COURSE_AGE_MS = 4000
// A derived course averaged over a longer window than this is a chord through
// history — it can embed a turn made many seconds ago (walk north 15 s, turn
// east: the chord points northeast long after the turn). Such a course may
// still blend when it broadly agrees, but it must not overrule a live
// high-confidence compass outright.
export const MAX_OVERRIDE_COURSE_WINDOW_S = 15

export function isBearingReliable(input: {
  distanceMeters: number
  accuracyMeters: number
  wasReliable?: boolean
}): boolean {
  const threshold = Math.max(
    MIN_BEARING_DISTANCE_METERS,
    input.accuracyMeters * BEARING_ACCURACY_MULTIPLIER,
  )
  const gate = input.wasReliable
    ? threshold * BEARING_HIDE_MULTIPLIER
    : threshold * BEARING_SHOW_MULTIPLIER
  return input.distanceMeters >= gate
}

function courseUsable(confidence: CourseConfidence | null, stale: boolean): boolean {
  return !stale && (confidence === 'high' || confidence === 'medium')
}

// How far the compass may disagree before the course wins outright, and how
// much compass goes into the blend, per compass confidence.
const BLEND_RULES: Record<HeadingConfidence, { maxDelta: number; compassWeight: number } | null> = {
  high: { maxDelta: 35, compassWeight: 0.35 },
  medium: { maxDelta: 50, compassWeight: 0.25 },
  low: null,
}

export function chooseNavigationHeading(input: {
  compassHeading: number | null
  compassConfidence: HeadingConfidence
  needsCalibration: boolean
  courseHeading: number | null
  courseConfidence: CourseConfidence | null
  courseStale: boolean
  // Derivation window of the course estimate; null/omitted (native or
  // unknown) is treated as instantaneous.
  courseWindowSeconds?: number | null
}): NavigationHeadingChoice {
  const hasCompass = input.compassHeading !== null && !input.needsCalibration
  const hasCourse =
    input.courseHeading !== null && courseUsable(input.courseConfidence, input.courseStale)

  if (!hasCompass && !hasCourse) return { heading: null, source: null }
  if (!hasCourse) {
    return { heading: normalize360(input.compassHeading as number), source: 'compass' }
  }
  if (!hasCompass) {
    return { heading: normalize360(input.courseHeading as number), source: 'gps-course' }
  }

  const compass = normalize360(input.compassHeading as number)
  const course = normalize360(input.courseHeading as number)
  const delta = Math.abs(shortestAngleDelta(compass, course))

  const blend = BLEND_RULES[input.compassConfidence]
  if (blend && delta <= blend.maxDelta) {
    const blended =
      weightedCircularMeanDegrees([
        { angle: compass, weight: blend.compassWeight },
        { angle: course, weight: 1 - blend.compassWeight },
      ]) ?? course
    return { heading: blended, source: 'blended' }
  }

  const longWindow =
    typeof input.courseWindowSeconds === 'number' &&
    input.courseWindowSeconds > MAX_OVERRIDE_COURSE_WINDOW_S
  if (longWindow && input.compassConfidence === 'high') {
    return { heading: compass, source: 'compass' }
  }

  return { heading: course, source: 'gps-course' }
}
