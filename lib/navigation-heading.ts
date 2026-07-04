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

  return { heading: course, source: 'gps-course' }
}
