'use client'

// Compass heading from DeviceOrientation (PRD §7.4, §12).
// iOS: webkitCompassHeading (true north, from 'deviceorientation').
// Android: 'deviceorientationabsolute' alpha (magnetic) + LA declination.

import { useCallback, useEffect, useRef, useState } from 'react'
import { DECLINATION_DEG, HEADING_SMOOTHING_ALPHA } from '@/lib/hunt-data'
import { normalize360, smoothAngle } from '@/lib/geo'

export type HeadingStatus = 'idle' | 'granted' | 'denied' | 'unavailable'

interface IOSOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

const ANDROID_EVENT_TIMEOUT_MS = 4000

export function useHeading() {
  const [status, setStatus] = useState<HeadingStatus>('idle')
  const [heading, setHeading] = useState<number | null>(null)
  const [needsCalibration, setNeedsCalibration] = useState(false)

  const smoothedRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const applyHeading = useCallback((raw: number) => {
    const next = smoothAngle(smoothedRef.current, normalize360(raw), HEADING_SMOOTHING_ALPHA)
    smoothedRef.current = next
    setHeading(next)
  }, [])

  const startListening = useCallback((): (() => void) => {
    const isIOS =
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
        .requestPermission === 'function'

    if (isIOS) {
      const onOrientation = (e: Event) => {
        const evt = e as IOSOrientationEvent
        const compass = evt.webkitCompassHeading
        if (typeof compass !== 'number') return
        // Negative or large accuracy → uncalibrated magnetometer (PRD §12).
        const acc = evt.webkitCompassAccuracy
        const bad = typeof acc === 'number' && (acc < 0 || acc > 50)
        setNeedsCalibration(bad)
        if (!bad) applyHeading(compass) // already true north
      }
      window.addEventListener('deviceorientation', onOrientation)
      return () => window.removeEventListener('deviceorientation', onOrientation)
    }

    // Android: absolute orientation only; relative alpha drifts and is useless.
    let gotAbsolute = false
    const timer = window.setTimeout(() => {
      if (!gotAbsolute) {
        setStatus('unavailable')
      }
    }, ANDROID_EVENT_TIMEOUT_MS)

    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (e.alpha === null) return
      if (e.absolute === false) {
        // Relative frame — treat as unavailable rather than show a wrong arrow.
        return
      }
      gotAbsolute = true
      setNeedsCalibration(false)
      const screenAngle =
        typeof screen !== 'undefined' && screen.orientation
          ? screen.orientation.angle
          : 0
      // alpha → compass heading (magnetic), then correct to true north for LA.
      const magnetic = normalize360(360 - e.alpha - screenAngle)
      applyHeading(magnetic + DECLINATION_DEG)
    }

    window.addEventListener('deviceorientationabsolute', onAbsolute as EventListener)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('deviceorientationabsolute', onAbsolute as EventListener)
    }
  }, [applyHeading])

  /**
   * MUST be called synchronously inside the user's tap handler, BEFORE any
   * await (iOS user-activation expires — PRD §12). Returns the resulting status.
   */
  const requestPermission = useCallback(async (): Promise<HeadingStatus> => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      setStatus('unavailable')
      return 'unavailable'
    }

    const doe = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (typeof doe.requestPermission === 'function') {
      // iOS 13+ — the promise itself must be created inside the activation.
      try {
        const result = await doe.requestPermission()
        if (result !== 'granted') {
          setStatus('denied')
          return 'denied'
        }
      } catch {
        setStatus('denied')
        return 'denied'
      }
    }

    cleanupRef.current?.()
    cleanupRef.current = startListening()
    setStatus('granted')
    return 'granted'
  }, [startListening])

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  return { status, heading, needsCalibration, requestPermission }
}
