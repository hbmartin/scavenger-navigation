'use client'

// The core NAVIGATING screen: arrow + distance + geofence detection (PRD §6.2–6.6).
// The geofence/debounce math itself lives in lib/arrival.ts (pure, unit-tested).

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, LocateFixed, RotateCw, SatelliteDish } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Fix } from '@/hooks/use-geolocation'
import {
  advanceArrival,
  approachProgress,
  heatLevel,
  INITIAL_ARRIVAL_STATE,
  isFixStale,
  manualMarkNeedsConfirmation,
  STALE_FIX_MS,
  type ArrivalState,
  type HeatLevel,
} from '@/lib/arrival'
import {
  bearingDegrees,
  formatDistance,
  haversineMeters,
  metersToFeet,
  unwrapAngle,
} from '@/lib/geo'
import type { Stop } from '@/lib/hunt-data'

interface NavigationScreenProps {
  stop: Stop
  stopNumber: number
  stopCount: number
  radiusMeters: number
  fix: Fix | null
  fixError: string | null
  heading: number | null
  needsCalibration: boolean
  onArrived: () => void
}

// Hot/cold signal (PRD §6.4 polish): the ring warms up as the distance drops.
const HEAT_CLASS: Record<HeatLevel, string> = {
  cold: 'text-sky-600',
  warm: 'text-amber-500',
  hot: 'text-orange-500',
  burning: 'text-red-500',
}

const RING_RADIUS = 108
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function NavigationScreen({
  stop,
  stopNumber,
  stopCount,
  radiusMeters,
  fix,
  fixError,
  heading,
  needsCalibration,
  onArrived,
}: NavigationScreenProps) {
  // Per-stop state resets via the `key={stop.id}` remount from HuntPage.
  const [arrival, setArrival] = useState<ArrivalState>(INITIAL_ARRIVAL_STATE)
  const [arrowRotation, setArrowRotation] = useState<number | null>(null)
  const [confirmingFound, setConfirmingFound] = useState(false)
  // Timestamp of the fix the watchdog has flagged as stale; staleness is
  // derived so a fresh fix clears the flag without extra renders.
  const [staleFixTimestamp, setStaleFixTimestamp] = useState<number | null>(null)

  const arrivalRef = useRef<ArrivalState>(INITIAL_ARRIVAL_STATE)
  const unwrappedRotationRef = useRef<number | null>(null)

  // Prefetch the arrival photo while walking so it's cached before poor
  // signal at the stop can get in the way (PRD §6.7 hardening).
  useEffect(() => {
    if (!stop.photoUrl) return
    const img = new Image()
    img.src = stop.photoUrl
  }, [stop.photoUrl])

  // Distance smoothing + geofence debounce on every fix (PRD §6.3, §6.6).
  useEffect(() => {
    if (!fix) return
    const prev = arrivalRef.current
    if (prev.arrived) return

    const raw = haversineMeters(fix.lat, fix.lng, stop.lat, stop.lng)
    const next = advanceArrival(prev, {
      rawDistanceMeters: raw,
      accuracyMeters: fix.accuracy,
      radiusMeters,
    })
    arrivalRef.current = next
    setArrival(next)
    if (next.arrived) onArrived()
  }, [fix, stop.lat, stop.lng, radiusMeters, onArrived])

  // Stale-fix watchdog: flag when the last fix is old enough that the
  // distance on screen can no longer be trusted (PRD §6.5 hardening).
  useEffect(() => {
    if (!fix) return
    const remaining = Math.max(0, fix.timestamp + STALE_FIX_MS - Date.now())
    const timer = window.setTimeout(() => {
      if (isFixStale(fix.timestamp, Date.now())) setStaleFixTimestamp(fix.timestamp)
    }, remaining + 250)
    return () => window.clearTimeout(timer)
  }, [fix])
  const fixStale = fix !== null && staleFixTimestamp === fix.timestamp

  // Arrow rotation via a continuous unwrapped angle so CSS animates the short arc (PRD §12).
  useEffect(() => {
    if (!fix || heading === null) return
    const bearing = bearingDegrees(fix.lat, fix.lng, stop.lat, stop.lng)
    const target = bearing - heading
    const prev = unwrappedRotationRef.current
    const next = prev === null ? ((target % 360) + 360) % 360 : unwrapAngle(prev, target)
    unwrappedRotationRef.current = next
    setArrowRotation(next)
  }, [fix, heading, stop.lat, stop.lng])

  const handleMarkFound = () => {
    // Manual override needs a second tap when GPS can't corroborate it (PRD §6.8).
    if (manualMarkNeedsConfirmation(arrival.smoothedDistance, radiusMeters)) {
      setConfirmingFound(true)
      return
    }
    onArrived()
  }

  const hasFix = fix !== null
  const headingLive = heading !== null && !needsCalibration
  const distance = arrival.smoothedDistance !== null ? formatDistance(arrival.smoothedDistance) : null
  const heat = arrival.smoothedDistance !== null ? heatLevel(arrival.smoothedDistance, radiusMeters) : null
  const ringFraction = approachProgress(arrival.startDistance, arrival.smoothedDistance)
  // Keep a small sliver visible so the heat color reads even at the start.
  const ringVisible = heat !== null ? Math.max(ringFraction, 0.04) : 0
  const accuracyFeet = fix ? Math.round(metersToFeet(fix.accuracy)) : null

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <p className="font-mono text-sm font-semibold uppercase tracking-widest">
          Stop {stopNumber} of {stopCount}
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: stopCount }, (_, i) => (
            <span
              key={i}
              className={`size-2 rounded-full ${i < stopNumber - 1 ? 'bg-primary' : i === stopNumber - 1 ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        {/* Arrow inside the hot/cold approach ring */}
        <div className="relative flex size-56 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 224 224" aria-hidden="true">
            <circle
              cx="112"
              cy="112"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="8"
              className="stroke-border"
            />
            {ringVisible > 0 && (
              <circle
                cx="112"
                cy="112"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                stroke="currentColor"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringVisible)}
                className={`transition-all duration-700 ease-out ${heat ? HEAT_CLASS[heat] : ''}`}
              />
            )}
          </svg>
          {headingLive && hasFix && arrowRotation !== null ? (
            <div
              className="transition-transform duration-200 ease-out"
              style={{ transform: `rotate(${arrowRotation}deg)` }}
              role="img"
              aria-label="Direction to target"
            >
              <ArrowUp className="size-36 text-accent" strokeWidth={2.5} aria-hidden="true" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              {needsCalibration ? (
                <>
                  <RotateCw className="size-10 animate-spin text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium leading-relaxed text-muted-foreground">
                    Compass needs calibrating — move your phone in a figure-8
                  </p>
                </>
              ) : (
                <>
                  <LocateFixed className="size-10 animate-pulse text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium leading-relaxed text-muted-foreground">
                    {!hasFix ? 'Getting your location…' : 'Waiting for compass…'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Distance */}
        <div className="flex flex-col items-center gap-1 text-center">
          {distance ? (
            <>
              <p
                className={`font-mono text-7xl font-bold tabular-nums leading-none transition-opacity ${fixStale ? 'opacity-40' : ''}`}
              >
                {distance.value}
                <span className="ml-2 text-3xl font-semibold text-muted-foreground">
                  {distance.unit}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">to the next stop</p>
            </>
          ) : (
            <p className="font-mono text-2xl font-semibold text-muted-foreground">— ft</p>
          )}
          {fixStale && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <SatelliteDish className="size-3.5" aria-hidden="true" />
              GPS signal lost — showing last known distance
            </p>
          )}
          {!fixStale && accuracyFeet !== null && (
            <p className="mt-1 text-xs text-muted-foreground/70">±{accuracyFeet} ft GPS accuracy</p>
          )}
          {fixError && fixError !== 'permission-denied' && (
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-destructive">{fixError}</p>
          )}
        </div>
      </div>

      <footer className="flex flex-col items-center gap-3">
        {confirmingFound ? (
          <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {distance
                ? `You still look ${distance.value} ${distance.unit} away. Mark this stop found anyway?`
                : `We can't confirm your location yet. Mark this stop found anyway?`}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="h-12 flex-1 bg-transparent"
                onClick={() => setConfirmingFound(false)}
              >
                Keep navigating
              </Button>
              <Button size="lg" className="h-12 flex-1" onClick={onArrived}>
                Yes, I&apos;m here
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full max-w-sm bg-transparent"
              onClick={handleMarkFound}
            >
              Mark found
            </Button>
            <p className="text-xs text-muted-foreground">
              Standing on it but GPS won&apos;t agree? Mark it found.
            </p>
          </>
        )}
      </footer>
    </main>
  )
}
