export function isTimestampExpired(
  timestamp: number | null,
  maxAgeMs: number,
  nowMs = Date.now(),
): boolean {
  return timestamp !== null && nowMs - timestamp >= maxAgeMs
}
