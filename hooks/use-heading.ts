'use client'

// Compass heading from DeviceOrientation (PRD §7.4, §12).
// iOS: webkitCompassHeading (true north, from 'deviceorientation').
// Android: 'deviceorientationabsolute' alpha (magnetic) + LA declination.

import { useCallback, useEffect, useRef, useState } from 'react'
import { DECLINATION_DEG, HEADING_SMOOTHING_ALPHA } from '@/lib/hunt-data'
import {
  circularMeanDegrees,
  limitAngleStep,
  normalize360,
  shortestAngleDelta,
  smoothAngle,
} from '@/lib/geo'
import {
  compassConfidenceFromAccuracy,
  type HeadingConfidence,
} from '@/lib/navigation-heading'

export type HeadingStatus = 'idle' | 'granted' | 'denied' | 'unavailable'

interface IOSOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

const ANDROID_EVENT_TIMEOUT_MS = 4000
const IOS_BAD_ACCURACY_DEG = 50
const HEADING_SAMPLE_WINDOW = 5
const HEADING_DEADBAND_DEG = 1.5
const HEADING_SPIKE_DEG = 80
const HEADING_SPIKE_CONFIRM_DEG = 25
const HEADING_MAX_STEP_DEG = 28

export function useHeading() {
  const [status, setStatus] = useState<HeadingStatus>('idle')
  const [heading, setHeading] = useState<number | null>(null)
  const [needsCalibration, setNeedsCalibration] = useState(false)
  const [headingConfidence, setHeadingConfidence] = useState<HeadingConfidence>('low')

  const smoothedRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const sampleWindowRef = useRef<number[]>([])
  const lastAcceptedRawRef = useRef<number | null>(null)
  const pendingSpikeRef = useRef<number | null>(null)

  const applyHeading = useCallback((raw: number) => {
    const normalized = normalize360(raw)
    const lastRaw = lastAcceptedRawRef.current
    let resetWindow = false

    if (lastRaw !== null) {
      const rawJump = Math.abs(shortestAngleDelta(lastRaw, normalized))
      if (rawJump >= HEADING_SPIKE_DEG) {
        // Confirm a spike with the NEXT consistent sample, whatever the event
        // cadence — a wall-clock window deadlocks at slow rates (each sample
        // arrives "too late", replaces the pending spike, and the heading
        // freezes after any real >=80° turn). Accepted samples clear the
        // pending spike below, so one-off glitches still never get through.
        const pending = pendingSpikeRef.current
        const confirmsPending =
          pending !== null &&
          Math.abs(shortestAngleDelta(pending, normalized)) <= HEADING_SPIKE_CONFIRM_DEG

        if (!confirmsPending) {
          pendingSpikeRef.current = normalized
          return
        }
        resetWindow = true
      }
    }

    pendingSpikeRef.current = null
    lastAcceptedRawRef.current = normalized

    const samples = resetWindow
      ? [normalized]
      : [...sampleWindowRef.current, normalized].slice(-HEADING_SAMPLE_WINDOW)
    sampleWindowRef.current = samples

    const averaged = circularMeanDegrees(samples) ?? normalized
    let next = smoothAngle(smoothedRef.current, averaged, HEADING_SMOOTHING_ALPHA)
    const prev = smoothedRef.current
    if (prev !== null) {
      const delta = Math.abs(shortestAngleDelta(prev, next))
      if (delta < HEADING_DEADBAND_DEG) return
      next = limitAngleStep(prev, next, HEADING_MAX_STEP_DEG)
    }

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
        // Functional update: the once-registered listener closure never sees
        // fresh state, but updaters chain per event even between renders.
        const acc = evt.webkitCompassAccuracy
        setHeadingConfidence((prev) => compassConfidenceFromAccuracy(acc, prev))
        const bad = typeof acc === 'number' && (acc < 0 || acc > IOS_BAD_ACCURACY_DEG)
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
      setHeadingConfidence('medium')
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

  return { status, heading, needsCalibration, headingConfidence, requestPermission }
}
