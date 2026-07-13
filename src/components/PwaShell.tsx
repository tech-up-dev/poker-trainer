import type { JSX } from 'react'

import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate'

// Bottom-anchored overlays for the installable PWA. Two things can appear
// here, either separately or stacked:
//
//   - "Install" prompt when the browser signals the app is installable and the
//     user hasn't dismissed it in the last week or already installed it.
//   - "Refresh" toast when a fresh deploy is waiting to activate, so members
//     never keep running a stale bundle without knowing about it.
//
// The wrapper is pointer-events-none so it never blocks taps on the app
// underneath; the individual cards re-enable pointer events on themselves.
export function PwaShell(): JSX.Element | null {
  const { canInstall, install, dismiss } = useInstallPrompt()
  const { updateReady, applyUpdate } = useServiceWorkerUpdate()

  if (!canInstall && !updateReady) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pointer-events-none">
      {updateReady ? (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 shadow-lg"
        >
          <span className="text-sm">A new version is available.</span>
          <button
            type="button"
            onClick={applyUpdate}
            className="rounded bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-emerald-400"
          >
            Refresh
          </button>
        </div>
      ) : null}

      {canInstall ? (
        <div
          role="dialog"
          aria-label="Install Poker Trainer"
          className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 shadow-lg"
        >
          <span className="text-sm">Install Poker Trainer for a full-screen app experience.</span>
          <button
            type="button"
            onClick={() => {
              void install()
            }}
            className="rounded bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-emerald-400"
          >
            Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="rounded px-2 py-1.5 text-sm text-slate-300 hover:text-white"
          >
            Not now
          </button>
        </div>
      ) : null}
    </div>
  )
}
