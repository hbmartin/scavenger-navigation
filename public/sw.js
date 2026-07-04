// Service worker: keep the hunt usable through dead zones (PRD §8 hardening).
//
// Strategy:
//  - navigations: network-first, falling back to the cached shell offline
//  - hashed build assets, icons, and stop photos: cache-first (immutable-ish)
//
// Bump CACHE_NAME to invalidate everything after a breaking deploy.

const CACHE_NAME = 'scavenger-nav-v1'
const APP_SHELL = ['/', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isCacheFirst(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/stops/') ||
    /\.(png|svg|jpg|jpeg|webp|ico|woff2?)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/')),
        ),
    )
    return
  }

  if (isCacheFirst(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
