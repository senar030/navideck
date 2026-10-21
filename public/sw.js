/* Navideck service worker.
 *
 * Keeps the app shell available so an installed Navideck starts instantly and
 * still opens when the network is down, and keeps cover art around, which is
 * the one Navidrome response that is worth caching: small, immutable per
 * id+size, and the slowest thing to fetch over a tailnet link.
 *
 * Everything else from Navidrome (the API and the audio streams) is never
 * cached: it is either authenticated per request or too large to be useful.
 *
 * Bump VERSION whenever a file in public/ changes, or when the strategy below
 * changes: that is what makes the shell and cover caches refresh.
 */

const VERSION = 'v4'
const SHELL_CACHE = `navideck-shell-${VERSION}`
const RUNTIME_CACHE = `navideck-runtime-${VERSION}`
const COVER_CACHE = `navideck-covers-${VERSION}`
/* A few hundred covers cover everything a phone shows in a session; the oldest
   ones are dropped first, so the cache cannot grow without bound. */
const COVER_LIMIT = 400

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
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE && key !== COVER_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
  // A cover the page could not render must not stay cached.
  if (event.data?.type === 'FORGET_COVER' && typeof event.data.url === 'string') {
    void forgetCover(event.data.url)
  }
})

/* --------------------------------------------------------------------------
   Cover art
   -------------------------------------------------------------------------- */

/** Cover ids are stable, so the auth parameters are dropped from the cache key. */
function coverKey(url) {
  const key = new URL(url.pathname, url.origin)
  key.searchParams.set('id', url.searchParams.get('id') || '')
  key.searchParams.set('size', url.searchParams.get('size') || '')
  return key.href
}

function isCoverArt(url) {
  return url.pathname.includes('/rest/getCoverArt')
}

async function coverArt(request, url) {
  const cache = await caches.open(COVER_CACHE)
  const key = coverKey(url)
  const cached = await cache.match(key)
  if (cached) return cached

  const response = await fetch(request)
  // Images are requested by <img> without CORS, so the response is opaque and
  // has no readable status; that is still fine to store and replay.
  if (response && (response.ok || response.type === 'opaque')) {
    await cache.put(key, response.clone())
    void trimCovers(cache)
  }
  return response
}

async function trimCovers(cache) {
  const keys = await cache.keys()
  const excess = keys.length - COVER_LIMIT
  if (excess <= 0) return
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)))
}

async function forgetCover(rawUrl) {
  try {
    const cache = await caches.open(COVER_CACHE)
    await cache.delete(coverKey(new URL(rawUrl)))
  } catch {
    /* nothing to do */
  }
}

/*
 * A static server answers a missing file with index.html and a 200. Storing that
 * under an asset URL pins the app to a module that is not JavaScript, and since
 * hashed bundles are served cache-first, the blank page would survive every
 * reload until the cache is dropped. HTML is therefore only ever stored for a
 * navigation, never in place of a bundle.
 */
function isCacheable(response, allowHtml = false) {
  if (!response || !response.ok || response.type !== 'basic') return false
  if (allowHtml) return true
  return !(response.headers.get('content-type') || '').includes('text/html')
}

/** Navigations: always try the network so a new build is picked up immediately. */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (isCacheable(response, true)) {
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
  // Cover art is the one Navidrome response worth keeping around.
  if (isCoverArt(url)) {
    event.respondWith(coverArt(request, url))
    return
  }
  // The rest of Navidrome lives on another origin (API, audio) — hands off.
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
