'use client'

// Top-level state machine (PRD §4) — transitions live in lib/hunt-machine.ts;
// this component wires browser APIs (permissions, sensors, storage) to it.

import { useCallback, useEffect, useReducer, useState } from 'react'
import { ArrivedScreen } from '@/components/arrived-screen'
import { BlockedScreen } from '@/components/blocked-screen'
import { CompleteScreen } from '@/components/complete-screen'
import { NavigationScreen } from '@/components/navigation-screen'
import { PermissionGate } from '@/components/permission-gate'
import { StartScreen } from '@/components/start-screen'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useHeading } from '@/hooks/use-heading'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { getStopSlug, HUNT } from '@/lib/hunt-data'
import { initialHuntState, makeHuntReducer } from '@/lib/hunt-machine'
import { loadProgress, saveProgress } from '@/lib/progress'

const GEO_PERMISSION_TIMEOUT_MS = 30000

const huntReducer = makeHuntReducer(HUNT.stops.length)

/** Short arrival buzz where supported (no-op on iOS Safari). */
function vibrateArrival() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([100, 50, 100])
  }
}

export default function HuntPage() {
  const [state, dispatch] = useReducer(huntReducer, HUNT.id, initialHuntState)
  const [requesting, setRequesting] = useState(false)
  const { phase, blockedReason, progress } = state

  const heading = useHeading()
  const { fix, error: fixError } = useGeolocation(phase === 'navigating')
  useWakeLock(phase === 'navigating')

  // INIT: restore saved progress (PRD §6.9).
  useEffect(() => {
    dispatch({ type: 'RESTORE', progress: loadProgress(HUNT.id) })
  }, [])

  // Persist whenever the machine changes progress.
  useEffect(() => {
    if (phase === 'init') return
    saveProgress(progress)
  }, [phase, progress])

  // PERMISSION_GATE "Enable" tap. Order is load-bearing (PRD §12):
  // requestPermission() fires synchronously inside the tap, geolocation after.
  const handleEnable = useCallback(() => {
    setRequesting(true)
    const headingPromise = heading.requestPermission()

    const geoPromise = new Promise<boolean>((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve(false)
        return
      }
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        // Only a hard denial blocks; timeouts/poor signal are handled while navigating.
        (err) => resolve(err.code !== err.PERMISSION_DENIED),
        { enableHighAccuracy: true, timeout: GEO_PERMISSION_TIMEOUT_MS },
      )
    })

    Promise.all([headingPromise, geoPromise]).then(([headingStatus, geoOk]) => {
      setRequesting(false)
      if (headingStatus !== 'granted') {
        dispatch({ type: 'PERMISSIONS_BLOCKED', reason: 'compass' })
        return
      }
      if (!geoOk) {
        dispatch({ type: 'PERMISSIONS_BLOCKED', reason: 'location' })
        return
      }
      dispatch({ type: 'PERMISSIONS_GRANTED' })
    })
  }, [heading])

  // Android compass can turn out unavailable after "granted" (no absolute events).
  useEffect(() => {
    if (heading.status === 'unavailable') {
      dispatch({ type: 'COMPASS_LOST' })
    }
  }, [heading.status, phase])

  const handleStart = useCallback(() => {
    dispatch({ type: 'START' })
  }, [])

  const currentStop = HUNT.stops[Math.min(progress.currentIndex, HUNT.stops.length - 1)]
  const currentStopSlug = getStopSlug(currentStop)
  const radiusMeters = currentStop.radiusMeters ?? HUNT.arrivalRadiusMeters

  const handleArrived = useCallback(() => {
    vibrateArrival()
    dispatch({ type: 'ARRIVED', stopSlug: currentStopSlug })
  }, [currentStopSlug])

  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT' })
  }, [])

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  switch (phase) {
    case 'init':
      return <main className="min-h-dvh" aria-busy="true" />
    case 'permission-gate':
      return (
        <PermissionGate huntTitle={HUNT.title} requesting={requesting} onEnable={handleEnable} />
      )
    case 'blocked':
      return <BlockedScreen reason={blockedReason} onRetry={handleEnable} />
    case 'ready':
      return (
        <StartScreen huntTitle={HUNT.title} stopCount={HUNT.stops.length} onStart={handleStart} />
      )
    case 'navigating':
      return (
        <NavigationScreen
          key={currentStopSlug} // remount per stop so smoothing/debounce state resets
          stop={currentStop}
          stopNumber={progress.currentIndex + 1}
          stopCount={HUNT.stops.length}
          radiusMeters={radiusMeters}
          fix={fix}
          fixError={fixError}
          heading={heading.heading}
          headingConfidence={heading.headingConfidence}
          needsCalibration={heading.needsCalibration}
          onArrived={handleArrived}
        />
      )
    case 'arrived':
      return (
        <ArrivedScreen
          stop={currentStop}
          stopNumber={progress.currentIndex + 1}
          stopCount={HUNT.stops.length}
          isLast={progress.currentIndex >= HUNT.stops.length - 1}
          onNext={handleNext}
        />
      )
    case 'complete':
      return (
        <CompleteScreen
          huntTitle={HUNT.title}
          stopCount={HUNT.stops.length}
          onRestart={handleRestart}
        />
      )
  }
}
