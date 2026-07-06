import { useEffect, useState } from 'react'

import { activateWaitingSw, onSwUpdateReady } from '../lib/register-sw'

// Surfaces "a new deploy is ready" to the UI. The service worker registration
// (in lib/register-sw) tracks the waiting worker; this hook mirrors that into
// React state so a toast can render. Calling applyUpdate posts SKIP_WAITING;
// the SW takes over, and register-sw's controllerchange listener reloads onto
// the fresh bundle.

export type ServiceWorkerUpdateState = {
  updateReady: boolean
  applyUpdate: () => void
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    return onSwUpdateReady(() => setUpdateReady(true))
  }, [])

  return { updateReady, applyUpdate: activateWaitingSw }
}
