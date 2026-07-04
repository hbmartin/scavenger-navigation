'use client'

// watchPosition wrapper (PRD §7.5). Watch only while NAVIGATING to save battery.

import { useCallback, useEffect, useRef, useState } from 'react'

export interface Fix {
  lat: number
  lng: number
  accuracy: number // meters
  timestamp: number
}

export function useGeolocation(active: boolean) {
  const [fix, setFix] = useState<Fix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) {
      stop()
      return
    }
    if (!('geolocation' in navigator)) return // surfaced via `supported` below
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('permission-denied')
        } else {
          setError(err.message || 'Location error')
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    )
    return stop
  }, [active, stop])

  // Derived, not effect-set: support never changes at runtime. Treated as
  // supported during SSR so server and first client render agree.
  const supported = typeof navigator === 'undefined' || 'geolocation' in navigator

  return { fix, error: supported ? error : 'Geolocation is not supported on this device.' }
}
