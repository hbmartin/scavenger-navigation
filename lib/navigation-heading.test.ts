import { describe, expect, it } from 'vitest'
import {
  chooseNavigationHeading,
  compassConfidenceFromAccuracy,
  isBearingReliable,
} from './navigation-heading'

describe('compassConfidenceFromAccuracy', () => {
  it('classifies steady accuracies at their nominal tier regardless of history', () => {
    // Dead-zone regressions: entry gates must sit AT the boundaries, or a
    // steady 15° (nominally high) / 35° (nominally medium) latches one tier
    // low forever.
    expect(compassConfidenceFromAccuracy(15, 'low')).toBe('high')
    expect(compassConfidenceFromAccuracy(15, 'medium')).toBe('high')
    expect(compassConfidenceFromAccuracy(35, 'low')).toBe('medium')
    expect(compassConfidenceFromAccuracy(18, 'low')).toBe('high')
  })

  it('holds the tier until accuracy clears the boundary by the margin', () => {
    expect(compassConfidenceFromAccuracy(21, 'high')).toBe('high')
    expect(compassConfidenceFromAccuracy(23, 'high')).toBe('medium')
    expect(compassConfidenceFromAccuracy(38, 'medium')).toBe('medium')
    expect(compassConfidenceFromAccuracy(40, 'medium')).toBe('low')
  })

  it('demotes without hysteresis help once the previous tier is lost', () => {
    expect(compassConfidenceFromAccuracy(23, 'medium')).toBe('medium')
    expect(compassConfidenceFromAccuracy(36, 'low')).toBe('low')
  })

  it('treats missing or negative accuracy as low', () => {
    expect(compassConfidenceFromAccuracy(undefined, 'high')).toBe('low')
    expect(compassConfidenceFromAccuracy(-1, 'high')).toBe('low')
  })
})

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

  it('does not let a long-window chord overrule a high-confidence compass', () => {
    // Walk north ~15 s then turn east: the 21 s chord still points northeast
    // while the live compass correctly reads east. The chord must not win.
    expect(
      chooseNavigationHeading({
        compassHeading: 90,
        compassConfidence: 'high',
        needsCalibration: false,
        courseHeading: 22,
        courseConfidence: 'medium',
        courseStale: false,
        courseWindowSeconds: 21,
      }),
    ).toEqual({ heading: 90, source: 'compass' })
  })

  it('lets a short-window course beat a disagreeing compass as before', () => {
    expect(
      chooseNavigationHeading({
        compassHeading: 90,
        compassConfidence: 'high',
        needsCalibration: false,
        courseHeading: 22,
        courseConfidence: 'medium',
        courseStale: false,
        courseWindowSeconds: 8,
      }),
    ).toEqual({ heading: 22, source: 'gps-course' })
  })

  it('lets a long-window course beat a compass that is not high-confidence', () => {
    // Below high confidence the compass is the less trusted signal even
    // against averaged history.
    expect(
      chooseNavigationHeading({
        compassHeading: 90,
        compassConfidence: 'low',
        needsCalibration: false,
        courseHeading: 22,
        courseConfidence: 'medium',
        courseStale: false,
        courseWindowSeconds: 21,
      }),
    ).toEqual({ heading: 22, source: 'gps-course' })
  })

  it('still blends a long-window course that broadly agrees', () => {
    const choice = chooseNavigationHeading({
      compassHeading: 10,
      compassConfidence: 'high',
      needsCalibration: false,
      courseHeading: 20,
      courseConfidence: 'medium',
      courseStale: false,
      courseWindowSeconds: 21,
    })
    expect(choice.source).toBe('blended')
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
