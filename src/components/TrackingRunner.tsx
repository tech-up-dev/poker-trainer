import { useEffect } from 'react'

import { router } from '../router'
import { TRACKED_PATHS, fetchTrackingConfig } from '../lib/tracking'
import type { TrackingConfig } from '../lib/tracking'

type Fbq = {
  (...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  loaded: boolean
  version: string
  push: unknown
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let configPromise: Promise<TrackingConfig> | null = null
let pixelStarted = false
let hyrosStarted = false
let lastTracked: string | null = null

function startMetaPixel(id: string): void {
  if (pixelStarted) return
  pixelStarted = true
  const fbq = function (...args: unknown[]): void {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as Fbq
  fbq.queue = []
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.push = fbq
  window.fbq = fbq
  window._fbq = fbq
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  fbq('init', id)
}

function startHyros(url: string): void {
  if (hyrosStarted) return
  hyrosStarted = true
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.async = true
  const sep = url.includes('?') ? '&' : '?'
  script.src = `${url}${sep}ref_url=${encodeURI(window.location.href)}`
  document.head.appendChild(script)
}

function onPage(pathname: string): void {
  if (!TRACKED_PATHS.includes(pathname) || lastTracked === pathname) return
  lastTracked = pathname
  configPromise ??= fetchTrackingConfig().catch(() => ({ meta_pixel_id: '', hyros_script_url: '' }))
  void configPromise.then((config) => {
    if (config.meta_pixel_id) {
      startMetaPixel(config.meta_pixel_id)
      window.fbq?.('track', 'PageView')
    }
    if (config.hyros_script_url) startHyros(config.hyros_script_url)
  })
}

// Sends page views to Facebook Pixel and Hyros on the pages Steve chose, using the
// IDs saved in the admin Settings page. Does nothing when nothing is configured.
export function TrackingRunner(): null {
  useEffect(() => {
    onPage(router.state.location.pathname)
    return router.subscribe((state) => onPage(state.location.pathname))
  }, [])
  return null
}
