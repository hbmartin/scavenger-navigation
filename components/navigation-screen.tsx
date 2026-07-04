'use client'

// The core NAVIGATING screen: arrow + distance + geofence detection (PRD §6.2–6.6).

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, LocateFixed, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Fix } from '@/hooks/use-geolocation'
import {
  bearingDegrees,
  formatDistance,
  haversineMeters,
  smoothScalar,
  unwrapAngle,
} from '@/lib/geo'
import {
  ACCURACY_GATE_MULTIPLIER,
  DEBOUNCE_FIX_COUNT,
  DISTANCE_SMOOTHING_ALPHA,
  type Stop,
} from '@/lib/hunt-data'

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
  const [smoothedDistance, setSmoothedDistance] = useState<number | null>(null)
  const [arrowRotation, setArrowRotation] = useState<number | null>(null)

  const smoothedDistanceRef = useRef<number | null>(null)
  const unwrappedRotationRef = useRef<number | null>(null)
  const inRadiusCountRef = useRef(0)
  const arrivedFiredRef = useRef(false)

  // Reset per-stop state when the target changes.
  useEffect(() => {
    smoothedDistanceRef.current = null
    unwrappedRotationRef.current = null
    inRadiusCountRef.current = 0
    arrivedFiredRef.current = false
    setSmoothedDistance(null)
    setArrowRotation(null)
  }, [stop.id])

  // Distance smoothing + geofence debounce on every fix (PRD §6.3, §6.6).
  useEffect(() => {
    if (!fix || arrivedFiredRef.current) return

    const raw = haversineMeters(fix.lat, fix.lng, stop.lat, stop.lng)
    const smoothed = smoothScalar(smoothedDistanceRef.current, raw, DISTANCE_SMOOTHING_ALPHA)
    smoothedDistanceRef.current = smoothed
    setSmoothedDistance(smoothed)

    const accuracyOk = fix.accuracy <= ACCURACY_GATE_MULTIPLIER * radiusMeters
    if (smoothed <= radiusMeters && accuracyOk) {
      inRadiusCountRef.current += 1
      if (inRadiusCountRef.current >= DEBOUNCE_FIX_COUNT) {
        arrivedFiredRef.current = true
        onArrived()
      }
    } else {
      inRadiusCountRef.current = 0
    }
  }, [fix, stop.lat, stop.lng, radiusMeters, onArrived])

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

  const hasFix = fix !== null
  const headingLive = heading !== null && !needsCalibration
  const distance = smoothedDistance !== null ? formatDistance(smoothedDistance) : null

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
        {/* Arrow */}
        <div className="relative flex size-56 items-center justify-center rounded-full border-4 border-border">
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
              <p className="font-mono text-7xl font-bold tabular-nums leading-none">
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
          {fixError && fixError !== 'permission-denied' && (
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-destructive">{fixError}</p>
          )}
        </div>
      </div>

      <footer className="flex flex-col items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-full max-w-sm bg-transparent"
          onClick={onArrived}
        >
          Mark found
        </Button>
        <p className="text-xs text-muted-foreground">
          Standing on it but GPS won&apos;t agree? Mark it found.
        </p>
      </footer>
    </main>
  )
}
