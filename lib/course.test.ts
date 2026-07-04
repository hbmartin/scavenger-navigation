import { describe, expect, it } from 'vitest'
import {
  courseBaseExpired,
  courseConfidence,
  derivedCourseEstimate,
  nativeCourseEstimate,
  type CoursePoint,
} from './course'

describe('courseConfidence', () => {
  it('requires movement before exposing a course', () => {
    expect(courseConfidence(0, 5)).toBeNull()
    expect(courseConfidence(0.2, 5)).toBeNull()
  })

  it('grades walking course by GPS accuracy', () => {
    expect(courseConfidence(1.2, 8)).toBe('high')
    expect(courseConfidence(1.2, 24)).toBe('medium')
    expect(courseConfidence(0.5, 24)).toBe('low')
    expect(courseConfidence(1.2, 50)).toBeNull()
  })
})

describe('nativeCourseEstimate', () => {
  it('normalizes valid browser headings', () => {
    expect(nativeCourseEstimate(370, 1.1, 8)).toMatchObject({
      heading: 10,
      source: 'native',
      confidence: 'high',
      windowSeconds: 0,
    })
  })

  it('ignores missing or stationary headings', () => {
    expect(nativeCourseEstimate(Number.NaN, 1.1, 8)).toBeNull()
    expect(nativeCourseEstimate(90, 0, 8)).toBeNull()
  })

  it('ignores low-confidence headings so derived fallback can run', () => {
    expect(nativeCourseEstimate(90, 0.5, 24)).toBeNull()
  })
})

describe('derivedCourseEstimate', () => {
  const start: CoursePoint = {
    lat: 34,
    lng: -118,
    accuracy: 8,
    timestamp: 1_700_000_000_000,
  }

  it('derives a course after enough movement', () => {
    const next: CoursePoint = {
      lat: 34.0001,
      lng: -118,
      accuracy: 8,
      timestamp: start.timestamp + 10_000,
    }
    const estimate = derivedCourseEstimate(start, next)
    expect(estimate).not.toBeNull()
    expect(estimate?.heading).toBeCloseTo(0, 0)
    expect(estimate?.source).toBe('derived')
  })

  it('rejects movement that is too small for the reported accuracy', () => {
    const next: CoursePoint = {
      lat: 34.00001,
      lng: -118,
      accuracy: 20,
      timestamp: start.timestamp + 10_000,
    }
    expect(derivedCourseEstimate(start, next)).toBeNull()
  })

  it('rejects a base point too old to give a meaningful speed', () => {
    // 300 s window: a fresh walk after a pause must not average against it.
    const next: CoursePoint = {
      lat: 34.001,
      lng: -118,
      accuracy: 8,
      timestamp: start.timestamp + 300_000,
    }
    expect(derivedCourseEstimate(start, next)).toBeNull()
  })

  it('accepts the long window a slow walker with mediocre accuracy needs', () => {
    // Accuracy 24 m → 18 m minimum distance: at ~0.9 m/s that takes ~25 s,
    // which must fit inside the window or the course is never attainable.
    const base: CoursePoint = { ...start, accuracy: 24 }
    const next: CoursePoint = {
      lat: 34.0002,
      lng: -118,
      accuracy: 24,
      timestamp: start.timestamp + 25_000,
    }
    const estimate = derivedCourseEstimate(base, next)
    expect(estimate).not.toBeNull()
    expect(estimate?.confidence).toBe('medium')
    // The window length rides along so heading selection can refuse to let a
    // long chord (which may embed an old turn) overrule a trusted compass.
    expect(estimate?.windowSeconds).toBe(25)
  })
})

describe('courseBaseExpired', () => {
  const base: CoursePoint = {
    lat: 34,
    lng: -118,
    accuracy: 8,
    timestamp: 1_700_000_000_000,
  }

  it('keeps an accurate base inside the stationary grace period', () => {
    const next: CoursePoint = { ...base, timestamp: base.timestamp + 15_000 }
    expect(courseBaseExpired(base, next)).toBe(false)
  })

  it('expires a base when timestamps do not advance', () => {
    const next: CoursePoint = { ...base, timestamp: base.timestamp }
    expect(courseBaseExpired(base, next)).toBe(true)
  })

  it('expires an inaccurate base inside the stationary grace period', () => {
    const inaccurateBase: CoursePoint = { ...base, accuracy: 50 }
    const next: CoursePoint = {
      ...base,
      accuracy: 8,
      timestamp: base.timestamp + 2_000,
    }
    expect(courseBaseExpired(inaccurateBase, next)).toBe(true)
  })

  it('expires a stationary base past the grace period', () => {
    // A pause must re-anchor promptly, or resumed walking averages against it.
    const next: CoursePoint = { ...base, timestamp: base.timestamp + 16_000 }
    expect(courseBaseExpired(base, next)).toBe(true)
  })

  it('keeps an old base while distance is still accruing at walking pace', () => {
    // ~22 m in 16 s: a slow walker must not lose the base before the
    // estimator's minimum distance is reached.
    const next: CoursePoint = {
      lat: 34.0002,
      lng: -118,
      accuracy: 8,
      timestamp: base.timestamp + 16_000,
    }
    expect(courseBaseExpired(base, next)).toBe(false)
  })

  it('expires an inaccurate base past the grace period even while moving', () => {
    const inaccurateBase: CoursePoint = { ...base, accuracy: 50 }
    const next: CoursePoint = {
      lat: 34.0002,
      lng: -118,
      accuracy: 8,
      timestamp: base.timestamp + 16_000,
    }
    expect(courseBaseExpired(inaccurateBase, next)).toBe(true)
  })

  it('expires any base once the derivation window closes', () => {
    const next: CoursePoint = {
      lat: 34.001,
      lng: -118,
      accuracy: 8,
      timestamp: base.timestamp + 30_001,
    }
    expect(courseBaseExpired(base, next)).toBe(true)
  })
})
