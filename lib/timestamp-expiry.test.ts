import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTimestampExpired } from './timestamp-expiry'

describe('isTimestampExpired', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the current render time for timestamps supplied after mount', () => {
    const maxAgeMs = 10_000
    const mountNowMs = 1_000_000
    const laterRenderNowMs = mountNowMs + 30_000
    const timestampThatBecameStaleBeforeRender = laterRenderNowMs - maxAgeMs

    expect(
      isTimestampExpired(timestampThatBecameStaleBeforeRender, maxAgeMs, laterRenderNowMs),
    ).toBe(true)
    expect(isTimestampExpired(timestampThatBecameStaleBeforeRender, maxAgeMs, mountNowMs)).toBe(
      false,
    )
  })

  it('defaults to the current clock time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(20_000)

    expect(isTimestampExpired(9_999, 10_000)).toBe(true)
    expect(isTimestampExpired(10_001, 10_000)).toBe(false)
    expect(isTimestampExpired(null, 10_000)).toBe(false)
  })
})
