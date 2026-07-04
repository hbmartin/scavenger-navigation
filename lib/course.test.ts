import { describe, expect, it } from 'vitest'
import {
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
    })
  })

  it('ignores missing or stationary headings', () => {
    expect(nativeCourseEstimate(Number.NaN, 1.1, 8)).toBeNull()
    expect(nativeCourseEstimate(90, 0, 8)).toBeNull()
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
})
