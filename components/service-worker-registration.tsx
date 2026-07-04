'use client'

// Registers the offline service worker (production only — caching in dev
// fights hot reload). Renders nothing.

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is best-effort; the app works without it.
    })
  }, [])
  return null
}
