import { useState } from 'react'
import type { JSX, FormEvent } from 'react'

import { supabaseProd } from '../lib/supabase-prod'

type Entitlement = {
  entitlement_key: string
  status: string
  expires_at: string | null
}

type FoundUser = {
  id: string
  email: string
  entitlements: Entitlement[]
}

type SearchResult = { user: FoundUser; entitlements: Entitlement[] }

export function EntitlementsAdminPage(): JSX.Element {
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<FoundUser | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSearch(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!email.trim()) return
    setSearching(true)
    setSearchError(null)
    setFound(null)
    setActionError(null)

    const { data, error } = await supabaseProd.functions.invoke<SearchResult>(
      'admin-entitlements',
      { body: { action: 'search', email: email.trim() } },
    )

    setSearching(false)
    if (error) { setSearchError(error.message); return }
    if (!data?.user) { setSearchError('No user found with that email.'); return }
    setFound({ ...data.user, entitlements: data.entitlements ?? [] })
  }

  async function handleGrant(entitlement_key = 'quiz_app_access'): Promise<void> {
    if (!found) return
    setBusy(true)
    setActionError(null)
    const { error } = await supabaseProd.functions.invoke('admin-entitlements', {
      body: { action: 'grant', user_id: found.id, entitlement_key },
    })
    setBusy(false)
    if (error) { setActionError(error.message); return }
    await refresh()
  }

  async function handleRevoke(entitlement_key = 'quiz_app_access'): Promise<void> {
    if (!found) return
    setBusy(true)
    setActionError(null)
    const { error } = await supabaseProd.functions.invoke('admin-entitlements', {
      body: { action: 'revoke', user_id: found.id, entitlement_key },
    })
    setBusy(false)
    if (error) { setActionError(error.message); return }
    await refresh()
  }

  async function refresh(): Promise<void> {
    if (!found) return
    const { data, error } = await supabaseProd.functions.invoke<SearchResult>(
      'admin-entitlements',
      { body: { action: 'search', email: found.email } },
    )
    if (!error && data?.user) {
      setFound({ ...data.user, entitlements: data.entitlements ?? [] })
    }
  }

  const hasAccess = found?.entitlements.some(
    (e) => e.entitlement_key === 'quiz_app_access' && e.status === 'active',
  )

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-ink">Member Access</h1>

      <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          required
          className="flex-1 bg-surface border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-link"
        />
        <button
          type="submit"
          disabled={searching || !email.trim()}
          className="px-4 py-2 rounded bg-link text-white text-sm disabled:opacity-40"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searchError && <p className="text-sm text-error">{searchError}</p>}

      {found && (
        <div className="bg-surface rounded-xl border border-line p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">{found.email}</p>
            <p className="text-xs text-ink-3 font-mono">{found.id}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-2">Entitlements</p>
            {found.entitlements.length === 0 ? (
              <p className="text-sm text-ink-3">None.</p>
            ) : (
              <div className="rounded-lg border border-line divide-y divide-line">
                {found.entitlements.map((ent) => (
                  <div key={ent.entitlement_key} className="flex items-center justify-between px-3 py-2">
                    <span className="font-mono text-xs text-ink">{ent.entitlement_key}</span>
                    <span className={`text-xs font-semibold ${ent.status === 'active' ? 'text-success' : 'text-ink-3'}`}>
                      {ent.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {actionError && <p className="text-sm text-error">{actionError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleGrant()}
              disabled={busy || !!hasAccess}
              className="px-4 py-2 rounded bg-success text-white text-sm disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Grant access'}
            </button>
            <button
              type="button"
              onClick={() => void handleRevoke()}
              disabled={busy || !hasAccess}
              className="px-4 py-2 rounded bg-error text-white text-sm disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Revoke access'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
