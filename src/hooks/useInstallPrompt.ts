import { useEffect, useState } from 'react'

// Wraps the browser's PWA install flow. The `beforeinstallprompt` event fires
// when the browser judges the app installable and the user hasn't installed it
// yet; we hold onto it so the app can present its own install button at the
// right moment instead of relying on the browser's built-in banner (which some
// platforms don't show at all). If the user dismisses, we suppress the prompt
// for a week so the surface doesn't nag on every visit.

type PromptChoice = 'accepted' | 'dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: PromptChoice }>
}

const DISMISS_KEY = 'pwa:install-dismissed-at'
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function isRecentlyDismissed(): boolean {
  const at = readDismissedAt()
  return at !== null && Date.now() - at < DISMISS_WINDOW_MS
}

function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari exposes standalone launch via a non-standard flag.
  const iosNav = navigator as Navigator & { standalone?: boolean }
  return iosNav.standalone === true
}

export type InstallPromptState = {
  canInstall: boolean
  install: () => Promise<void>
  dismiss: () => void
}

export function useInstallPrompt(): InstallPromptState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => isRunningStandalone())
  const [dismissed, setDismissed] = useState<boolean>(() => isRecentlyDismissed())

  useEffect(() => {
    if (installed) return

    const onBeforeInstall = (event: Event): void => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = (): void => {
      setInstalled(true)
      setPromptEvent(null)
      try {
        localStorage.removeItem(DISMISS_KEY)
      } catch {
        // ignore
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [installed])

  const install = async (): Promise<void> => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'dismissed') {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()))
      } catch {
        // ignore
      }
      setDismissed(true)
    }
    setPromptEvent(null)
  }

  const dismiss = (): void => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  return {
    canInstall: !installed && !dismissed && promptEvent !== null,
    install,
    dismiss,
  }
}
