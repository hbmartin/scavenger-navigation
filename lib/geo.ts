// Pure geo/angle math. No browser APIs — unit-testable off-device.

const EARTH_RADIUS_M = 6371000
const DEG = Math.PI / 180

/** Normalize any angle to [0, 360). */
export function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Great-circle distance in meters between two points (haversine). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG
  const dLng = (lng2 - lng1) * DEG
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Forward azimuth from point 1 to point 2, degrees clockwise from true north [0, 360). */
export function bearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLng = (lng2 - lng1) * DEG
  const y = Math.sin(dLng) * Math.cos(lat2 * DEG)
  const x =
    Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
    Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos(dLng)
  return normalize360(Math.atan2(y, x) / DEG)
}

/** Signed shortest angular difference from `from` to `to`, in (-180, 180]. */
export function shortestAngleDelta(from: number, to: number): number {
  let delta = normalize360(to) - normalize360(from)
  if (delta > 180) delta -= 360
  if (delta <= -180) delta += 360
  return delta
}

/**
 * Accumulate a continuous (unwrapped) rotation so CSS transforms always
 * animate the short arc across the 359° → 0° seam.
 * `prevUnwrapped` may be any real number; `targetDeg` is a [0,360) angle.
 */
export function unwrapAngle(prevUnwrapped: number, targetDeg: number): number {
  return prevUnwrapped + shortestAngleDelta(prevUnwrapped, targetDeg)
}

/**
 * Angular exponential smoothing done in vector space (sin/cos average)
 * to avoid the wrap seam. Returns a [0,360) angle.
 * alpha in (0,1]; higher = snappier.
 */
export function smoothAngle(
  prevDeg: number | null,
  nextDeg: number,
  alpha: number,
): number {
  if (prevDeg === null) return normalize360(nextDeg)
  const px = Math.cos(prevDeg * DEG)
  const py = Math.sin(prevDeg * DEG)
  const nx = Math.cos(nextDeg * DEG)
  const ny = Math.sin(nextDeg * DEG)
  const x = px + alpha * (nx - px)
  const y = py + alpha * (ny - py)
  if (x === 0 && y === 0) return normalize360(nextDeg)
  return normalize360(Math.atan2(y, x) / DEG)
}

/** Scalar exponential smoothing for distance. */
export function smoothScalar(
  prev: number | null,
  next: number,
  alpha: number,
): number {
  if (prev === null) return next
  return prev + alpha * (next - prev)
}

export function metersToFeet(m: number): number {
  return m * 3.28084
}

/** Feet below 1000 ft, miles (1 decimal) above. */
export function formatDistance(meters: number): { value: string; unit: string } {
  const feet = metersToFeet(meters)
  if (feet < 1000) {
    return { value: String(Math.round(feet)), unit: 'ft' }
  }
  const miles = feet / 5280
  return { value: miles.toFixed(1), unit: 'mi' }
}
