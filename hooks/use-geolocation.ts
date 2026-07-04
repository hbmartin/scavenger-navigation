'use client'

// watchPosition wrapper (PRD §7.5). Watch only while NAVIGATING to save battery.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  derivedCourseEstimate,
  MAX_COURSE_BASE_AGE_MS,
  nativeCourseEstimate,
  type CourseConfidence,
  type CoursePoint,
} from '@/lib/course'

export interface Fix {
  lat: number
  lng: number
  accuracy: number // meters
  timestamp: number
  courseHeading: number | null // direction of travel, degrees clockwise from true north
  courseConfidence: CourseConfidence | null
}

export function useGeolocation(active: boolean) {
  const [fix, setFix] = useState<Fix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const courseBaseRef = useRef<CoursePoint | null>(null)

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    courseBaseRef.current = null
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
        const point: CoursePoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
        const nativeCourse = nativeCourseEstimate(
          pos.coords.heading,
          pos.coords.speed,
          pos.coords.accuracy,
        )
        const derivedCourse = nativeCourse ? null : derivedCourseEstimate(courseBaseRef.current, point)
        const course = nativeCourse ?? derivedCourse

        // Re-base while stationary too: a base frozen at pause-start would
        // dilute distance/elapsed and suppress the course long after walking
        // resumes (speed recovers only after ~pause/3 of walking).
        const base = courseBaseRef.current
        const baseStale = base !== null && point.timestamp - base.timestamp > MAX_COURSE_BASE_AGE_MS
        if (course || base === null || baseStale) {
          courseBaseRef.current = point
        }

        setFix({
          lat: point.lat,
          lng: point.lng,
          accuracy: point.accuracy,
          timestamp: point.timestamp,
          courseHeading: course?.heading ?? null,
          courseConfidence: course?.confidence ?? null,
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
