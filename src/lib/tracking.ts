import { supabaseProd } from './supabase-prod'

// Only these pages are tracked, on purpose: Steve does not want every lesson and
// question page sending data to his ad tools.
export const TRACKED_PATHS = ['/login', '/signup', '/subscribe', '/play', '/play/courses']

export type TrackingConfig = {
  // Facebook (Meta) Pixel ID, digits only. Empty = off.
  meta_pixel_id: string
  // Hyros script address (https, hyros.com only). Empty = off.
  hyros_script_url: string
}

export const EMPTY_TRACKING_CONFIG: TrackingConfig = { meta_pixel_id: '', hyros_script_url: '' }

const SETTING_KEY = 'tracking_config'

export function isValidPixelId(id: string): boolean {
  return /^\d{5,20}$/.test(id)
}

function isHyrosUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && (u.hostname === 'hyros.com' || u.hostname.endsWith('.hyros.com'))
  } catch {
    return false
  }
}

// Pulls the script address out of whatever Steve pastes (the full Hyros snippet or
// just the address). Only the address is kept, never the pasted code itself.
export function parseHyrosSnippet(text: string): string | null {
  const candidates = text.match(/https:\/\/[^\s"'<>]+/g) ?? []
  for (const raw of candidates) {
    const cleaned = raw.replace(/([?&])ref_url=[^&]*/, '').replace(/[?&]$/, '')
    if (isHyrosUrl(cleaned)) return cleaned
  }
  return null
}

function normalize(value: unknown): TrackingConfig {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const pixel = typeof v.meta_pixel_id === 'string' ? v.meta_pixel_id.trim() : ''
  const hyros = typeof v.hyros_script_url === 'string' ? v.hyros_script_url.trim() : ''
  return {
    meta_pixel_id: isValidPixelId(pixel) ? pixel : '',
    hyros_script_url: isHyrosUrl(hyros) ? hyros : '',
  }
}

export async function fetchTrackingConfig(): Promise<TrackingConfig> {
  const { data } = await supabaseProd.from('app_settings').select('value').eq('key', SETTING_KEY).maybeSingle()
  return normalize(data?.value)
}

export async function saveTrackingConfig(config: TrackingConfig): Promise<void> {
  const { data, error } = await supabaseProd
    .from('app_settings')
    .update({ value: config })
    .eq('key', SETTING_KEY)
    .select('key')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('The tracking setting does not exist yet. Ask the back-end developer to apply the latest migration.')
  }
}
