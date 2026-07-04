import { describe, expect, it } from 'vitest'
import {
  chooseNavigationHeading,
  isBearingReliable,
} from './navigation-heading'

describe('isBearingReliable', () => {
  it('rejects target bearings inside the GPS accuracy cone', () => {
    expect(isBearingReliable({ distanceMeters: 12, accuracyMeters: 10 })).toBe(false)
  })

  it('accepts target bearings comfortably outside the GPS accuracy cone', () => {
    expect(isBearingReliable({ distanceMeters: 30, accuracyMeters: 10 })).toBe(true)
  })

  it('uses a minimum distance floor even with very accurate GPS', () => {
    expect(isBearingReliable({ distanceMeters: 5, accuracyMeters: 1 })).toBe(false)
  })
})

describe('chooseNavigationHeading', () => {
  it('uses compass when no walking course is available', () => {
    expect(
      chooseNavigationHeading({
        compassHeading: 45,
        compassConfidence: 'high',
        needsCalibration: false,
        courseHeading: null,
        courseConfidence: null,
      }),
    ).toEqual({ heading: 45, source: 'compass' })
  })

  it('uses GPS course when the compass needs calibration', () => {
    expect(
      chooseNavigationHeading({
        compassHeading: 45,
        compassConfidence: 'low',
        needsCalibration: true,
        courseHeading: 90,
        courseConfidence: 'high',
      }),
    ).toEqual({ heading: 90, source: 'gps-course' })
  })

  it('prefers walking course when it disagrees with compass', () => {
    expect(
      chooseNavigationHeading({
        compassHeading: 10,
        compassConfidence: 'high',
        needsCalibration: false,
        courseHeading: 100,
        courseConfidence: 'high',
      }),
    ).toEqual({ heading: 100, source: 'gps-course' })
  })

  it('blends compass and course when they broadly agree', () => {
    const choice = chooseNavigationHeading({
      compassHeading: 10,
      compassConfidence: 'high',
      needsCalibration: false,
      courseHeading: 20,
      courseConfidence: 'high',
    })
    expect(choice.source).toBe('blended')
    expect(choice.heading).not.toBeNull()
    expect(choice.heading as number).toBeGreaterThan(10)
    expect(choice.heading as number).toBeLessThan(20)
  })
})
