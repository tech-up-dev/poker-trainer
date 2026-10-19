import { useEffect, useState, useCallback } from 'react'
import type { JSX, ChangeEvent } from 'react'
import { Search, Send, ShieldCheck, ShieldOff, Clock, Trash2 } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'
import { useAuth } from '../lib/auth-context'
import { ConfirmDialog } from '../components/ConfirmDialog'

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
type DeleteState = 'idle' | 'confirming' | 'confirming-cancel' | 'deleting' | 'error'

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

function MemberRow({
  member,
  isSelf,
  onResetSent,
  onDeleted,
}: {
  member: Member
  isSelf: boolean
  onResetSent: (email: string) => void
  onDeleted: (userId: string) => void
}): JSX.Element {
  const [resetState, setResetState] = useState<ResetState>('idle')
  const [resetError, setResetError] = useState<string | null>(null)
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const canDelete = !isSelf && !member.is_admin

  async function handleReset(): Promise<void> {
    setResetState('sending')
    setResetError(null)
    const { error } = await supabaseProd.functions.invoke('admin-send-recovery', {
      body: {
        email: member.email,
        redirect_to: `${window.location.origin}/reset-password`,
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

  async function handleDelete(cancelSubscription = false): Promise<void> {
    setDeleteState('deleting')
    setDeleteError(null)
    const { data, error } = await supabaseProd.functions.invoke<{ ok: boolean; message?: string }>(
      'admin-delete-user',
      { body: { user_id: member.user_id, ...(cancelSubscription ? { cancel_subscription: true } : {}) } },
    )
    if (error) {
      let body: { code?: string; message?: string } | undefined
      try {
        body = await (error as { context?: Response }).context?.json?.()
      } catch { /* fall back to the generic message */ }
      if (body?.code === 'active_subscription') {
        setDeleteState('confirming-cancel')
        return
      }
      setDeleteState('error')
      setDeleteError(body?.message ?? error.message)
      return
    }
    if (data?.ok === false) {
      setDeleteState('error')
      setDeleteError(data.message ?? 'Delete failed')
      return
    }
    onDeleted(member.user_id)
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
        <div className="flex flex-col items-end gap-1.5">
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
        {canDelete && (
          <button
            type="button"
            onClick={() => setDeleteState('confirming')}
            disabled={deleteState === 'deleting'}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-error hover:underline transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleteState === 'deleting' ? 'Deleting…' : 'Delete user'}
          </button>
        )}
        {deleteState === 'error' && (
          <span className="text-xs text-error">{deleteError ?? 'Delete failed'}</span>
        )}
        </div>
        <ConfirmDialog
          open={deleteState === 'confirming'}
          title="Delete this user?"
          message={`${member.email} will be permanently deleted, along with their lessons, stats and session history. This cannot be undone.`}
          confirmLabel="Delete user"
          destructive
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteState('idle')}
        />
        <ConfirmDialog
          open={deleteState === 'confirming-cancel'}
          title="This member has an active subscription"
          message={`${member.email} is still paying. Deleting them will also cancel their subscription in Stripe, then permanently remove their account and data. This cannot be undone.`}
          confirmLabel="Cancel subscription and delete"
          destructive
          onConfirm={() => void handleDelete(true)}
          onCancel={() => setDeleteState('idle')}
        />
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
  const { session } = useAuth()

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

  function handleDeleted(userId: string): void {
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
  }

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
                    isSelf={member.user_id === session?.user?.id}
                    onResetSent={handleResetSent}
                    onDeleted={handleDeleted}
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
