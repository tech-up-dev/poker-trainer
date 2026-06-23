import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { session, isAdmin, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already signed in as an admin? Skip the form.
  if (!loading && session && isAdmin) {
    return <Navigate to="/admin" replace />
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 bg-slate-800/50 border border-slate-700 rounded-lg p-6"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Content Ops sign in</h1>
          <p className="text-sm text-slate-400">Admin access required.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-slate-950 text-slate-100 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-slate-950 text-slate-100 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error !== null ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
