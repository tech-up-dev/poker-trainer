import { useEffect, useState, useCallback } from 'react'
import type { JSX, ChangeEvent } from 'react'
import { Search, Send, ShieldCheck, ShieldOff, Clock } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'

type Member = {
  user_id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  last_active_date: string | null
  access_status: string
  access_source: string | null
  access_expires_at: string | null
  is_admin: boolean
}

type ResetState = 'idle' | 'sending' | 'sent' | 'error'

const EMPTY_DASH = String.fromCharCode(8212) // U+2014, kept out of raw source for no-em-dash lint

function formatDate(iso: string | null): string {
  if (!iso) return EMPTY_DASH
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function AccessBadge({ status }: { status: string }): JSX.Element {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
        <ShieldCheck className="w-3.5 h-3.5" />
        Active
      </span>
    )
  }
  if (status === 'none') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3">
        <ShieldOff className="w-3.5 h-3.5" />
        No access
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
      <Clock className="w-3.5 h-3.5" />
      {status}
    </span>
  )
}

function MemberRow({ member, onResetSent }: { member: Member; onResetSent: (email: string) => void }): JSX.Element {
  const [resetState, setResetState] = useState<ResetState>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleReset(): Promise<void> {
    setResetState('sending')
    setResetError(null)
    const { error } = await supabaseProd.functions.invoke('admin-send-recovery', {
      body: {
        email: member.email,
        redirect_to: 'https://poker-trainer-olive-rho.vercel.app/reset-password',
      },
    })
    if (error) {
      setResetState('error')
      setResetError(error.message)
    } else {
      setResetState('sent')
      onResetSent(member.email)
    }
  }

  return (
    <tr className="border-t border-line hover:bg-surface-overlay transition-colors">
      <td className="px-4 py-3 min-w-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink truncate max-w-[220px]">{member.email}</span>
          {member.is_admin && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold">Admin</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <AccessBadge status={member.access_status} />
        {member.access_source && (
          <p className="text-[10px] text-ink-3 mt-0.5">{member.access_source}</p>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap">
        {formatDate(member.last_active_date)}
      </td>
      <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap">
        {formatDate(member.last_sign_in_at)}
      </td>
      <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap">
        {formatDate(member.created_at)}
      </td>
      <td className="px-4 py-3 text-right">
        {resetState === 'sent' ? (
          <span className="text-xs text-success font-medium">Reset sent</span>
        ) : resetState === 'error' ? (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-error">{resetError ?? 'Failed'}</span>
            <button
              type="button"
              onClick={() => void handleReset()}
              className="text-xs text-link hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={resetState === 'sending'}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink transition-colors disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            {resetState === 'sending' ? 'Sending…' : 'Reset password'}
          </button>
        )}
      </td>
    </tr>
  )
}

export function AdminMembersPage(): JSX.Element {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [recentResets, setRecentResets] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabaseProd.functions.invoke<{ members: Member[] }>(
      'admin-members',
      { body: {} },
    )
    setLoading(false)
    if (error) { setLoadError(error.message); return }
    setMembers((data?.members ?? []) as Member[])
  }, [])

  useEffect(() => {
    // load() awaits before every setState (network round-trip), so state is
    // never set synchronously in the effect body. Rule can't see across the
    // await into useCallback so we suppress it here explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function handleResetSent(email: string): void {
    setRecentResets((prev) => new Set([...prev, email]))
  }

  const filtered = query.trim()
    ? members.filter((m) => m.email.toLowerCase().includes(query.toLowerCase()))
    : members

  const activeCount = members.filter((m) => m.access_status === 'active').length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-gold mb-1">
            Admin · Members
          </p>
          <h1 className="text-3xl font-bold text-ink">Member Directory</h1>
          {!loading && (
            <p className="text-ink-2 mt-1">
              {members.length} total · {activeCount} active
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="btn-secondary btn-sm shrink-0"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loadError && (
        <p className="text-sm text-error" role="alert">{loadError}</p>
      )}

      {recentResets.size > 0 && (
        <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3">
          <p className="text-sm text-success">
            Password reset sent to: {[...recentResets].join(', ')}
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Filter by email…"
          className="input pl-10 w-full max-w-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-ink-3">Loading members…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-3">
          {query ? 'No members match that email.' : 'No members found.'}
        </p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-overlay">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Access</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Last active</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Last sign-in</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    onResetSent={handleResetSent}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
