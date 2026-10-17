import { useEffect, useState } from 'react'

/* --------------------------------------------------------------------------
   Environment helpers
   -------------------------------------------------------------------------- */

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as NavigatorWithStandalone).standalone === true
  return (
    iosStandalone ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

export function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Safari is the only iOS browser that can add a page to the home screen. */
export function isIosSafari(): boolean {
  if (!isIos()) return false
  return /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent)
}

/**
 * Browsers only expose service workers (and therefore installation and the
 * offline shell) over HTTPS — plain HTTP, even on the local network, is not a
 * secure context. `http://localhost` is the one exception.
 */
export function isSecureOrigin(): boolean {
  return window.isSecureContext === true
}

/* --------------------------------------------------------------------------
   Install prompt
   -------------------------------------------------------------------------- */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: InstallPromptEvent | null = null
let installed = isStandalone()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null && !installed
}

export function isAppInstalled(): boolean {
  return installed
}

/** Shows the browser's own install dialog. Android/Chrome only. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  // The event can only be used once.
  deferredPrompt = null
  notify()
  try {
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') installed = true
    notify()
    return choice.outcome
  } catch {
    return 'unavailable'
  }
}

export function watchInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    notify()
  })
  for (const query of ['(display-mode: standalone)', '(display-mode: fullscreen)']) {
    window.matchMedia(query).addEventListener('change', (event) => {
      installed = event.matches || isStandalone()
      notify()
    })
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useInstallState() {
  const [state, setState] = useState(() => ({
    canInstall: canPromptInstall(),
    installed: isAppInstalled(),
  }))
  useEffect(
    () =>
      subscribe(() => setState({ canInstall: canPromptInstall(), installed: isAppInstalled() })),
    [],
  )
  return { ...state, promptInstall }
}

/* --------------------------------------------------------------------------
   Service worker
   -------------------------------------------------------------------------- */

function isPlaying(): boolean {
  return navigator.mediaSession?.playbackState === 'playing'
}

/** A new build is waiting: reload, but never in the middle of a track. */
function reloadWhenIdle(): void {
  if (!isPlaying()) {
    window.location.reload()
    return
  }
  const timer = window.setInterval(() => {
    if (isPlaying()) return
    window.clearInterval(timer)
    window.location.reload()
  }, 10_000)
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  if (!isSecureOrigin()) {
    console.info('[pwa] over HTTP: no service worker, no offline mode, no installation. Serve over HTTPS.')
    return
  }

  let reloading = false
  // A first install also fires `controllerchange` (the worker claims the page);
  // reloading for that would be pointless, so only updates reload.
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return
    reloading = true
    reloadWhenIdle()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // Only take over when a previous version is controlling the page,
            // otherwise this is the very first install.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        let lastCheck = 0
        const checkForUpdate = () => {
          if (Date.now() - lastCheck < 60_000) return
          lastCheck = Date.now()
          void registration.update().catch(() => undefined)
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate()
        })
        checkForUpdate()
      })
      .catch(() => undefined)
  })
}
