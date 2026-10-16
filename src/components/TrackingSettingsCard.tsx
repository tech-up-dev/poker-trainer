import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'

import {
  EMPTY_TRACKING_CONFIG,
  TRACKED_PATHS,
  fetchTrackingConfig,
  isValidPixelId,
  parseHyrosSnippet,
  saveTrackingConfig,
} from '../lib/tracking'
import type { TrackingConfig } from '../lib/tracking'

export function TrackingSettingsCard(): JSX.Element {
  const [saved, setSaved] = useState<TrackingConfig>(EMPTY_TRACKING_CONFIG)
  const [pixelId, setPixelId] = useState('')
  const [hyrosText, setHyrosText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchTrackingConfig()
      .then((c) => { setSaved(c); setPixelId(c.meta_pixel_id) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (saving) return
    setMessage(null)

    const pixel = pixelId.trim()
    if (pixel !== '' && !isValidPixelId(pixel)) {
      setMessage({ kind: 'error', text: 'The Pixel ID should be numbers only (usually 15 or 16 digits).' })
      return
    }

    // Empty box keeps what is saved; a pasted snippet replaces it.
    let hyros = saved.hyros_script_url
    if (hyrosText.trim() !== '') {
      const parsed = parseHyrosSnippet(hyrosText)
      if (!parsed) {
        setMessage({ kind: 'error', text: 'Could not find a Hyros script address in what you pasted. Paste the full snippet from Hyros.' })
        return
      }
      hyros = parsed
    }

    setSaving(true)
    const next: TrackingConfig = { meta_pixel_id: pixel, hyros_script_url: hyros }
    try {
      await saveTrackingConfig(next)
      setSaved(next)
      setHyrosText('')
      setMessage({ kind: 'ok', text: 'Saved. Tracking is live on the pages listed below.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    }
    setSaving(false)
  }

  async function clearHyros(): Promise<void> {
    setSaving(true)
    setMessage(null)
    const next: TrackingConfig = { ...saved, hyros_script_url: '' }
    try {
      await saveTrackingConfig(next)
      setSaved(next)
      setMessage({ kind: 'ok', text: 'Hyros tracking removed.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-ink-3">Loading…</p>

  return (
    <form onSubmit={(e) => void handleSave(e)} className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Tracking</h2>
        <p className="text-sm text-ink-2 mt-1">
          Facebook Pixel and Hyros run only on these pages:{' '}
          <span className="font-mono text-ink">{TRACKED_PATHS.join(', ')}</span>. Leave a field empty to turn it off.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="meta-pixel" className="label">Facebook Pixel ID</label>
        <input
          id="meta-pixel"
          type="text"
          inputMode="numeric"
          value={pixelId}
          onChange={(e) => setPixelId(e.target.value)}
          placeholder="e.g. 123456789012345"
          className="input"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="hyros" className="label">Hyros tracking snippet</label>
        <textarea
          id="hyros"
          value={hyrosText}
          onChange={(e) => setHyrosText(e.target.value)}
          rows={4}
          placeholder={saved.hyros_script_url ? 'Paste a new snippet to replace the saved one' : 'Paste the snippet from Hyros here'}
          className="input font-mono text-xs"
        />
        {saved.hyros_script_url ? (
          <p className="text-xs text-ink-3 break-all">
            Saved script: <span className="font-mono text-ink-2">{saved.hyros_script_url}</span>{' '}
            <button type="button" onClick={() => void clearHyros()} disabled={saving} className="text-gold underline underline-offset-2">
              Remove
            </button>
          </p>
        ) : null}
      </div>

      {message ? (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-success' : 'text-error'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save tracking'}
        </button>
      </div>
    </form>
  )
}
