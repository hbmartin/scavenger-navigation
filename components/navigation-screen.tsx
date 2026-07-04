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
  manualMarkNeedsConfirmation,
  STALE_FIX_MS,
  type ArrivalState,
  type HeatLevel,
} from '@/lib/arrival'
import {
  bearingDegrees,
  formatDistance,
  haversineMeters,
  normalize360,
  unwrapAngle,
} from '@/lib/geo'
import type { Stop } from '@/lib/hunt-data'
import {
  chooseNavigationHeading,
  isBearingReliable,
  MAX_COURSE_AGE_MS,
  type HeadingConfidence,
} from '@/lib/navigation-heading'
import { isTimestampExpired } from '@/lib/timestamp-expiry'

interface NavigationScreenProps {
  stop: Stop
  stopNumber: number
  stopCount: number
  radiusMeters: number
  fix: Fix | null
  fixError: string | null
  heading: number | null
  headingConfidence: HeadingConfidence
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

// Extra timer delay so watchdogs fire safely past their deadline, not on it.
const WATCHDOG_SLACK_MS = 250

/**
 * True once `timestamp` has gone unreplaced for `maxAgeMs`. Already-old
 * timestamps are expired against the current render time; the latched timestamp
 * catches timestamps that age out after mount. The timer re-checks the clock
 * when it fires and re-arms if it fired early — background tabs clamp timers.
 */
function useExpiredTimestamp(timestamp: number | null, maxAgeMs: number): boolean {
  const [expiredTimestamp, setExpiredTimestamp] = useState<number | null>(null)

  useEffect(() => {
    if (timestamp === null) return
    let timer: number | undefined
    const arm = () => {
      const remainingMs = timestamp + maxAgeMs - Date.now()
      if (remainingMs <= 0) {
        setExpiredTimestamp(timestamp)
        return
      }
      timer = window.setTimeout(arm, remainingMs + WATCHDOG_SLACK_MS)
    }
    arm()
    return () => window.clearTimeout(timer)
  }, [timestamp, maxAgeMs])

  return (
    timestamp !== null &&
    (expiredTimestamp === timestamp || isTimestampExpired(timestamp, maxAgeMs))
  )
}

export function NavigationScreen({
  stop,
  stopNumber,
  stopCount,
  radiusMeters,
  fix,
  fixError,
  heading,
  headingConfidence,
  needsCalibration,
  onArrived,
}: NavigationScreenProps) {
  // Per-stop state resets via the slug-based key remount from HuntPage.
  const [arrival, setArrival] = useState<ArrivalState>(INITIAL_ARRIVAL_STATE)
  const [arrowRotation, setArrowRotation] = useState<number | null>(null)
  const [confirmingFound, setConfirmingFound] = useState(false)

  // Previous verdict for the isBearingReliable hysteresis. A dedicated latch,
  // NOT arrow visibility: the arrow also hides on compass loss and stale
  // fixes, and re-entering through the wider "show" gate after an unrelated
  // blip would strand the arrow hidden during the final approach.
  const [wasBearingReliable, setWasBearingReliable] = useState(false)

  const arrivalRef = useRef<ArrivalState>(INITIAL_ARRIVAL_STATE)
  const unwrappedRotationRef = useRef<number | null>(null)

  // Prefetch the arrival photo while walking so it's cached before poor
  // signal at the stop can get in the way (PRD §6.7 hardening).
  useEffect(() => {
    if (!stop.photoUrl) return
    const img = new Image()
    img.src = stop.photoUrl
  }, [stop.photoUrl])

  const rawDistanceMeters = fix
    ? haversineMeters(fix.lat, fix.lng, stop.lat, stop.lng)
    : null

  // Distance smoothing + geofence debounce on every fix (PRD §6.3, §6.6).
  useEffect(() => {
    if (!fix || rawDistanceMeters === null) return
    const prev = arrivalRef.current
    if (prev.arrived) return

    const next = advanceArrival(prev, {
      rawDistanceMeters,
      accuracyMeters: fix.accuracy,
      radiusMeters,
    })
    arrivalRef.current = next
    setArrival(next)
    if (next.arrived) onArrived()
  }, [fix, rawDistanceMeters, radiusMeters, onArrived])

  // Stale-fix watchdog: flag when the last fix is old enough that the
  // distance on screen can no longer be trusted (PRD §6.5 hardening).
  const fixStale = useExpiredTimestamp(fix?.timestamp ?? null, STALE_FIX_MS)

  // Course-expiry watchdog: a walking course describes where the user WAS
  // heading. If no fresh fix replaces it (platforms can go quiet while the
  // user stands still and turns), stop letting it override the live compass.
  const courseStale = useExpiredTimestamp(
    fix !== null && fix.courseHeading !== null ? fix.timestamp : null,
    MAX_COURSE_AGE_MS,
  )

  const navigationHeading = chooseNavigationHeading({
    compassHeading: heading,
    compassConfidence: headingConfidence,
    needsCalibration,
    courseHeading: fix?.courseHeading ?? null,
    courseConfidence: fix?.courseConfidence ?? null,
    courseStale,
  })
  // Hysteresis keyed off the previous verdict, so GPS jitter around the
  // reliability threshold can't strobe the arrow during the final approach.
  const bearingReliable =
    fix !== null &&
    rawDistanceMeters !== null &&
    isBearingReliable({
      distanceMeters: rawDistanceMeters,
      accuracyMeters: fix.accuracy,
      wasReliable: wasBearingReliable,
    })
  // Latch the verdict for the next evaluation (render-time set per React's
  // "storing information from previous renders"; it converges immediately
  // because the verdict is a fixed point of its own output).
  if (bearingReliable !== wasBearingReliable) setWasBearingReliable(bearingReliable)

  // The one arrow gate, shared by the rotation effect and the render so the
  // two can't drift: heading loss, staleness, and reliability hide the arrow
  // on the render they flip; the rotation state catches up (clears) in the
  // effect below.
  const arrowActive =
    fix !== null && navigationHeading.heading !== null && !fixStale && bearingReliable

  // Arrow rotation via a continuous unwrapped angle so CSS animates the short
  // arc (PRD §12). The arrow keeps rendering the previous rotation for the
  // one frame until this effect commits — never gate the arrow on the
  // rotation matching this render's inputs, or it blinks off on every update.
  useEffect(() => {
    const headingDeg = navigationHeading.heading
    // When the arrow is hidden, clear the rotation rather than keep it:
    // repainting a stale unwrapped angle on re-show would animate a
    // wrong-way multi-turn spin. (The null re-checks only narrow types —
    // arrowActive already implies them.)
    let next: number | null = null
    if (arrowActive && fix !== null && headingDeg !== null) {
      const bearing = bearingDegrees(fix.lat, fix.lng, stop.lat, stop.lng)
      const prev = unwrappedRotationRef.current
      next = prev === null ? normalize360(bearing - headingDeg) : unwrapAngle(prev, bearing - headingDeg)
    }
    unwrappedRotationRef.current = next
    setArrowRotation(next)
  }, [arrowActive, fix, navigationHeading.heading, stop.lat, stop.lng])

  const handleMarkFound = () => {
    // Manual override needs a second tap when GPS can't corroborate it (PRD §6.8).
    if (manualMarkNeedsConfirmation(arrival.smoothedDistance, radiusMeters)) {
      setConfirmingFound(true)
      return
    }
    onArrived()
  }

  const hasFix = fix !== null
  const showDirectionArrow = arrowActive && arrowRotation !== null
  const distance = arrival.smoothedDistance !== null ? formatDistance(arrival.smoothedDistance) : null
  const heat = arrival.smoothedDistance !== null ? heatLevel(arrival.smoothedDistance, radiusMeters) : null
  const ringFraction = approachProgress(arrival.startDistance, arrival.smoothedDistance)
  // Keep a small sliver visible so the heat color reads even at the start.
  const ringVisible = heat !== null ? Math.max(ringFraction, 0.04) : 0
  const accuracyMeters = fix ? Math.round(fix.accuracy) : null
  const hint = stop.hint?.trim()

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
        <div className="flex flex-col items-center gap-4">
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
            {showDirectionArrow ? (
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
                      {!hasFix
                        ? 'Getting your location…'
                        : fixStale
                          ? 'Waiting for GPS signal…'
                          : !bearingReliable
                            ? 'Direction is noisy this close; use distance'
                            : 'Waiting for compass…'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {hint && (
            <p className="max-w-sm whitespace-pre-line text-center text-sm font-medium leading-relaxed text-muted-foreground">
              {hint}
            </p>
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
            <p className="font-mono text-2xl font-semibold text-muted-foreground">— m</p>
          )}
          {fixStale && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <SatelliteDish className="size-3.5" aria-hidden="true" />
              GPS signal lost — showing last known distance
            </p>
          )}
          {!fixStale && accuracyMeters !== null && (
            <p className="mt-1 text-xs text-muted-foreground/70">±{accuracyMeters} m GPS accuracy</p>
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
