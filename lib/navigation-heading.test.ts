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

  it('holds its previous verdict inside the hysteresis band', () => {
    // threshold 20 m: the band between hide (17) and show (23) keeps state.
    expect(
      isBearingReliable({ distanceMeters: 21, accuracyMeters: 10, wasReliable: true }),
    ).toBe(true)
    expect(
      isBearingReliable({ distanceMeters: 21, accuracyMeters: 10, wasReliable: false }),
    ).toBe(false)
  })

  it('flips only past the band edges', () => {
    expect(
      isBearingReliable({ distanceMeters: 16, accuracyMeters: 10, wasReliable: true }),
    ).toBe(false)
    expect(
      isBearingReliable({ distanceMeters: 24, accuracyMeters: 10, wasReliable: false }),
    ).toBe(true)
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
        courseStale: false,
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
        courseStale: false,
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
        courseStale: false,
      }),
    ).toEqual({ heading: 100, source: 'gps-course' })
  })

  it('ignores a stale course so the live compass wins after a stop-and-turn', () => {
    expect(
      chooseNavigationHeading({
        compassHeading: 190,
        compassConfidence: 'high',
        needsCalibration: false,
        courseHeading: 10,
        courseConfidence: 'high',
        courseStale: true,
      }),
    ).toEqual({ heading: 190, source: 'compass' })
  })

  it('blends compass and course when they broadly agree', () => {
    const choice = chooseNavigationHeading({
      compassHeading: 10,
      compassConfidence: 'high',
      needsCalibration: false,
      courseHeading: 20,
      courseConfidence: 'high',
      courseStale: false,
    })
    expect(choice.source).toBe('blended')
    expect(choice.heading).not.toBeNull()
    expect(choice.heading as number).toBeGreaterThan(10)
    expect(choice.heading as number).toBeLessThan(20)
  })
})
