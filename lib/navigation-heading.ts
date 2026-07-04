import {
  normalize360,
  shortestAngleDelta,
  weightedCircularMeanDegrees,
} from './geo'
import type { CourseConfidence } from './course'

export type NavigationHeadingSource = 'compass' | 'gps-course' | 'blended'
export type HeadingConfidence = 'low' | 'medium' | 'high'

export interface NavigationHeadingChoice {
  heading: number | null
  source: NavigationHeadingSource | null
}

export const MIN_BEARING_DISTANCE_METERS = 8
export const BEARING_ACCURACY_MULTIPLIER = 2

export function isBearingReliable(input: {
  distanceMeters: number
  accuracyMeters: number
}): boolean {
  const threshold = Math.max(
    MIN_BEARING_DISTANCE_METERS,
    input.accuracyMeters * BEARING_ACCURACY_MULTIPLIER,
  )
  return input.distanceMeters >= threshold
}

function courseUsable(confidence: CourseConfidence | null): boolean {
  return confidence === 'high' || confidence === 'medium'
}

export function chooseNavigationHeading(input: {
  compassHeading: number | null
  compassConfidence: HeadingConfidence
  needsCalibration: boolean
  courseHeading: number | null
  courseConfidence: CourseConfidence | null
}): NavigationHeadingChoice {
  const hasCompass = input.compassHeading !== null && !input.needsCalibration
  const hasCourse = input.courseHeading !== null && courseUsable(input.courseConfidence)

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

  if (input.compassConfidence === 'high' && delta <= 35) {
    const blended =
      weightedCircularMeanDegrees([
        { angle: compass, weight: 0.35 },
        { angle: course, weight: 0.65 },
      ]) ?? course
    return {
      heading: blended,
      source: 'blended',
    }
  }

  if (input.compassConfidence === 'medium' && delta <= 50) {
    const blended =
      weightedCircularMeanDegrees([
        { angle: compass, weight: 0.25 },
        { angle: course, weight: 0.75 },
      ]) ?? course
    return {
      heading: blended,
      source: 'blended',
    }
  }

  return { heading: course, source: 'gps-course' }
}
