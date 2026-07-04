import { describe, expect, it } from 'vitest'
import {
  chooseNavigationHeading,
  compassConfidenceFromAccuracy,
  isBearingReliable,
  MAX_OVERRIDE_COURSE_WINDOW_S,
} from './navigation-heading'
import { MAX_DERIVED_COURSE_WINDOW_MS } from './course'

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
    expect(compassConfidenceFromAccuracy(25, 'high')).toBe('high')
    expect(compassConfidenceFromAccuracy(27, 'high')).toBe('medium')
    expect(compassConfidenceFromAccuracy(42, 'medium')).toBe('medium')
    expect(compassConfidenceFromAccuracy(44, 'medium')).toBe('low')
  })

  it('settles instead of strobing when jitter spans a boundary', () => {
    // ±3° wobble across the high boundary (17↔23) promotes once and holds;
    // under a narrower margin it would flip tiers on every sensor event.
    let tier = compassConfidenceFromAccuracy(17, 'medium')
    expect(tier).toBe('high')
    for (const accuracy of [23, 17, 23, 17]) {
      tier = compassConfidenceFromAccuracy(accuracy, tier)
      expect(tier).toBe('high')
    }
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
        courseWindowSeconds: null,
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
        courseWindowSeconds: null,
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
        courseWindowSeconds: null,
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
        courseWindowSeconds: null,
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

  it('does not let a long-window chord overrule a medium-confidence compass', () => {
    // The chord embeds an old turn just the same when the compass is medium;
    // any blend-trusted compass holds against a >15 s chord.
    expect(
      chooseNavigationHeading({
        compassHeading: 90,
        compassConfidence: 'medium',
        needsCalibration: false,
        courseHeading: 22,
        courseConfidence: 'medium',
        courseStale: false,
        courseWindowSeconds: 21,
      }),
    ).toEqual({ heading: 90, source: 'compass' })
  })

  it('lets a long-window course beat a low-confidence compass', () => {
    // A low-confidence compass has no blend rule — the chord is still the
    // better signal even against averaged history.
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
      courseWindowSeconds: null,
    })
    expect(choice.source).toBe('blended')
    expect(choice.heading).not.toBeNull()
    expect(choice.heading as number).toBeGreaterThan(10)
    expect(choice.heading as number).toBeLessThan(20)
  })
})

describe('MAX_OVERRIDE_COURSE_WINDOW_S', () => {
  it('stays below the derivation cap so the override guard is reachable', () => {
    // derivedCourseEstimate rejects windows past MAX_DERIVED_COURSE_WINDOW_MS,
    // so a threshold at or above that cap could never fire.
    expect(MAX_OVERRIDE_COURSE_WINDOW_S * 1000).toBeLessThan(MAX_DERIVED_COURSE_WINDOW_MS)
  })
})
