// Registers the PWA service worker and brokers update signals to React.
//
// Registration runs once at app boot (called from main.tsx). Consumers subscribe
// via onSwUpdateReady to learn when a new SW has installed and is waiting to
// activate; calling activateWaitingSw triggers takeover and, via the
// controllerchange listener below, reloads the page onto the fresh bundle.
//
// Localhost is skipped because the SW would cache Vite's dynamic module graph
// and cause stale-bundle errors on refresh during development.

type UpdateListener = () => void

const listeners = new Set<UpdateListener>()
let waitingWorker: ServiceWorker | null = null

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function onSwUpdateReady(listener: UpdateListener): () => void {
  listeners.add(listener)
  if (waitingWorker) listener()
  return () => {
    listeners.delete(listener)
  }
}

export function activateWaitingSw(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
}

function trackInstalling(reg: ServiceWorkerRegistration): void {
  const installing = reg.installing
  if (!installing) return
  installing.addEventListener('statechange', () => {
    // Only surface as an "update" when a prior version is already in control.
    // First-time installs shouldn't nag the user to refresh.
    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
      waitingWorker = installing
      emit()
    }
  })
}

export function registerSw(): void {
  if (!('serviceWorker' in navigator)) return
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return

  const hadController = navigator.serviceWorker.controller !== null

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // A previous session may have installed this update already.
        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingWorker = reg.waiting
          emit()
        }
        reg.addEventListener('updatefound', () => trackInstalling(reg))
      })
      .catch(() => {
        // Registration failed; app still works, offline/install just won't.
      })

    // Reload once the new SW takes control, so the user lands on the fresh
    // bundle. Guarded so a first-time install (no prior controller) doesn't
    // surprise the user with an unexpected reload.
    if (hadController) {
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    }
  })
}
