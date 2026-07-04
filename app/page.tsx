'use client'

// Top-level state machine (PRD §4):
// INIT → PERMISSION_GATE → (BLOCKED ↔) READY → NAVIGATING ↔ ARRIVED → COMPLETE

import { useCallback, useEffect, useState } from 'react'
import { ArrivedScreen } from '@/components/arrived-screen'
import { BlockedScreen } from '@/components/blocked-screen'
import { CompleteScreen } from '@/components/complete-screen'
import { NavigationScreen } from '@/components/navigation-screen'
import { PermissionGate } from '@/components/permission-gate'
import { StartScreen } from '@/components/start-screen'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useHeading } from '@/hooks/use-heading'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { HUNT } from '@/lib/hunt-data'
import { defaultProgress, loadProgress, saveProgress, type Progress } from '@/lib/progress'

type Phase =
  | 'init'
  | 'permission-gate'
  | 'blocked'
  | 'ready'
  | 'navigating'
  | 'arrived'
  | 'complete'

const GEO_PERMISSION_TIMEOUT_MS = 30000

export default function HuntPage() {
  const [phase, setPhase] = useState<Phase>('init')
  const [blockedReason, setBlockedReason] = useState<'location' | 'compass'>('location')
  const [requesting, setRequesting] = useState(false)
  const [progress, setProgress] = useState<Progress>(() => defaultProgress(HUNT.id))

  const heading = useHeading()
  const { fix, error: fixError } = useGeolocation(phase === 'navigating')
  useWakeLock(phase === 'navigating')

  // INIT: restore saved progress (PRD §6.9).
  useEffect(() => {
    const saved = loadProgress(HUNT.id)
    setProgress(saved)
    setPhase(saved.finished ? 'complete' : 'permission-gate')
  }, [])

  const transition = useCallback((next: Progress, nextPhase: Phase) => {
    saveProgress(next)
    setProgress(next)
    setPhase(nextPhase)
  }, [])

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
        setBlockedReason('compass')
        setPhase('blocked')
        return
      }
      if (!geoOk) {
        setBlockedReason('location')
        setPhase('blocked')
        return
      }
      // Resume mid-hunt players directly at their current stop (PRD §6.9).
      setPhase(progress.started ? 'navigating' : 'ready')
    })
  }, [heading, progress.started])

  // Android compass can turn out unavailable after "granted" (no absolute events).
  useEffect(() => {
    if (heading.status === 'unavailable' && (phase === 'navigating' || phase === 'ready')) {
      setBlockedReason('compass')
      setPhase('blocked')
    }
  }, [heading.status, phase])

  const handleStart = useCallback(() => {
    transition({ ...progress, started: true }, 'navigating')
  }, [progress, transition])

  const handleArrived = useCallback(() => {
    const stop = HUNT.stops[progress.currentIndex]
    const completed = progress.completedStopIds.includes(stop.id)
      ? progress.completedStopIds
      : [...progress.completedStopIds, stop.id]
    transition({ ...progress, completedStopIds: completed }, 'arrived')
  }, [progress, transition])

  const handleNext = useCallback(() => {
    const isLast = progress.currentIndex >= HUNT.stops.length - 1
    if (isLast) {
      transition({ ...progress, finished: true }, 'complete')
    } else {
      transition({ ...progress, currentIndex: progress.currentIndex + 1 }, 'navigating')
    }
  }, [progress, transition])

  const currentStop = HUNT.stops[Math.min(progress.currentIndex, HUNT.stops.length - 1)]
  const radiusMeters = currentStop.radiusMeters ?? HUNT.arrivalRadiusMeters

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
          stop={currentStop}
          stopNumber={progress.currentIndex + 1}
          stopCount={HUNT.stops.length}
          radiusMeters={radiusMeters}
          fix={fix}
          fixError={fixError}
          heading={heading.heading}
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
      return <CompleteScreen huntTitle={HUNT.title} stopCount={HUNT.stops.length} />
  }
}
