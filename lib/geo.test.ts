import { describe, expect, it } from 'vitest'
import {
  bearingDegrees,
  formatDistance,
  haversineMeters,
  normalize360,
  shortestAngleDelta,
  smoothAngle,
  smoothScalar,
  unwrapAngle,
} from './geo'

describe('normalize360', () => {
  it('keeps in-range values', () => {
    expect(normalize360(0)).toBe(0)
    expect(normalize360(359.5)).toBe(359.5)
  })
  it('wraps values above 360', () => {
    expect(normalize360(360)).toBe(0)
    expect(normalize360(725)).toBe(5)
  })
  it('wraps negative values', () => {
    expect(normalize360(-10)).toBe(350)
    expect(normalize360(-370)).toBe(350)
  })
})

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters(34.05, -118.25, 34.05, -118.25)).toBe(0)
  })
  it('matches a known LA distance (Griffith → Santa Monica Pier, ~21.5 km)', () => {
    const d = haversineMeters(34.118434, -118.300393, 34.008663, -118.498646)
    expect(d).toBeGreaterThan(21000)
    expect(d).toBeLessThan(23000)
  })
  it('handles small distances (~25 m geofence scale)', () => {
    // ~0.000225° latitude ≈ 25 m
    const d = haversineMeters(34.05, -118.25, 34.050225, -118.25)
    expect(d).toBeGreaterThan(23)
    expect(d).toBeLessThan(27)
  })
})

describe('bearingDegrees', () => {
  it('points north for due-north target', () => {
    expect(bearingDegrees(34, -118, 35, -118)).toBeCloseTo(0, 0)
  })
  it('points ~east for due-east target', () => {
    const b = bearingDegrees(34, -118, 34, -117)
    expect(b).toBeGreaterThan(89)
    expect(b).toBeLessThan(91)
  })
  it('points south for due-south target', () => {
    expect(bearingDegrees(35, -118, 34, -118)).toBeCloseTo(180, 0)
  })
  it('points ~west for due-west target', () => {
    const b = bearingDegrees(34, -117, 34, -118)
    expect(b).toBeGreaterThan(269)
    expect(b).toBeLessThan(271)
  })
})

describe('shortestAngleDelta', () => {
  it('handles simple deltas', () => {
    expect(shortestAngleDelta(10, 30)).toBe(20)
    expect(shortestAngleDelta(30, 10)).toBe(-20)
  })
  it('crosses the 359→0 seam the short way', () => {
    expect(shortestAngleDelta(350, 10)).toBe(20)
    expect(shortestAngleDelta(10, 350)).toBe(-20)
  })
  it('returns +180 for opposite angles', () => {
    expect(shortestAngleDelta(0, 180)).toBe(180)
  })
})

describe('unwrapAngle', () => {
  it('accumulates continuously across the seam (no long-way spin)', () => {
    // Arrow at 350°, target moves to 10°: unwrapped should go to 370, not 10.
    expect(unwrapAngle(350, 10)).toBe(370)
    // And back down.
    expect(unwrapAngle(370, 350)).toBe(350)
  })
  it('works from negative unwrapped values', () => {
    expect(unwrapAngle(-10, 340)).toBe(-20)
  })
})

describe('smoothAngle', () => {
  it('passes through on first sample', () => {
    expect(smoothAngle(null, 123, 0.3)).toBe(123)
  })
  it('moves toward target', () => {
    const s = smoothAngle(0, 90, 0.5)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(90)
  })
  it('smooths across the wrap seam without swinging through 180', () => {
    const s = smoothAngle(358, 2, 0.5)
    // Should land near 0, not near 180.
    expect(s > 350 || s < 10).toBe(true)
  })
})

describe('smoothScalar', () => {
  it('passes through on first sample', () => {
    expect(smoothScalar(null, 42, 0.35)).toBe(42)
  })
  it('applies exponential smoothing', () => {
    expect(smoothScalar(100, 200, 0.5)).toBe(150)
  })
})

describe('formatDistance', () => {
  it('shows meters below 1000 m', () => {
    expect(formatDistance(100)).toEqual({ value: '100', unit: 'm' })
    expect(formatDistance(0)).toEqual({ value: '0', unit: 'm' })
  })
  it('switches to kilometers at 1000 m', () => {
    expect(formatDistance(1000).unit).toBe('km')
    expect(formatDistance(999).unit).toBe('m')
  })
  it('formats kilometers to one decimal', () => {
    expect(formatDistance(1609.34)).toEqual({ value: '1.6', unit: 'km' })
  })
})
