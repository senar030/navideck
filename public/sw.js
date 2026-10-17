/* Navideck service worker.
 *
 * Keeps the app shell available so an installed Navideck starts instantly and
 * still opens when the network is down. Navidrome traffic (the REST API, cover
 * art and audio streams) is never cached: it is either authenticated per
 * request or too large to be useful offline.
 *
 * Bump VERSION whenever a file in public/ changes, or when the strategy below
 * changes: that is what makes the shell cache refresh.
 */

const VERSION = 'v1'
const SHELL_CACHE = `navideck-shell-${VERSION}`
const RUNTIME_CACHE = `navideck-runtime-${VERSION}`

const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      // Add the files one by one: a single failure must not abort the install.
      await Promise.all(
        SHELL_FILES.map((file) =>
          cache.add(new Request(file, { cache: 'reload' })).catch(() => undefined),
        ),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === 'basic'
}

/** Navigations: always try the network so a new build is picked up immediately. */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (isCacheable(response)) {
      await cache.put('/index.html', response.clone())
      return response
    }
    // A server error (proxy down, backend restarting) is no reason to show an
    // error page when the previous build is sitting in the cache.
    if (response.status >= 500) {
      const cached = (await cache.match('/index.html')) || (await cache.match('/'))
      if (cached) return cached
    }
    return response
  } catch {
    const cached = (await cache.match('/index.html')) || (await cache.match('/'))
    return cached || Response.error()
  }
}

/** Everything else that is not a hashed bundle: fresh when online, cached offline. */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    if (isCacheable(response)) {
      await cache.put(request, response.clone())
      return response
    }
    if (response.status >= 500) {
      const cached = await cache.match(request)
      if (cached) return cached
    }
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || Response.error()
  }
}

/** Hashed bundles never change under the same name, so the cache always wins. */
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (isCacheable(response)) await cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Navidrome lives on another origin (API, cover art, audio) — hands off.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/rest/')) return
  // Partial content (seeking inside a track) must never be served from the cache.
  if (request.headers.has('range')) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  // Vite emits content-hashed filenames, so they are safe to pin.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request))
})
