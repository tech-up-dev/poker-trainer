// Service worker for the installable PWA.
//
// The caching strategy is deliberately built around the content-publish flow so
// a "promote to production" always reaches members and never leaves them on
// stale content:
//
//   - Cross-origin requests (Supabase content/API, Stripe, etc.) are NOT cached.
//     Published lessons are always fetched live, so a promote shows up at once.
//   - App navigations are network-first, falling back to the cached shell when
//     offline, so a new deploy is picked up immediately when the network is up.
//   - Hashed static assets (Vite fingerprints them) are immutable, so they're
//     served cache-first and cached on first fetch.
//
// Bump CACHE_VERSION on a release that must invalidate the cached shell; the
// activate handler drops every older cache.

const CACHE_VERSION = 'v1'
const CACHE_NAME = `poker-trainer-${CACHE_VERSION}`
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  // Take over without waiting for existing tabs to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never cache cross-origin traffic. Supabase content must always be live so a
  // promote to production is seen immediately.
  if (url.origin !== self.location.origin) return

  // Navigations: network-first so new deploys appear right away; cached shell
  // is the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? caches.match('/'))),
    )
    return
  }

  // Same-origin static assets: cache-first, then network (and cache it).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        }),
    ),
  )
})
