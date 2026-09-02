import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { JSX } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { useAuth } from '../lib/auth-context'
import { pollForEntitlement, postPurchaseSignIn } from '../lib/checkout'

type Phase = 'signing-in' | 'polling' | 'success' | 'timeout' | 'error'

export function CheckoutSuccessPage(): JSX.Element {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('polling')
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    const sessionId = searchParams.get('session_id')

    // Anon buyer: no auth session yet, but we have a Stripe session_id.
    // Call post-purchase-signin to get a one-time recovery link, then redirect.
    if (!session && sessionId) {
      setPhase('signing-in')
      postPurchaseSignIn(sessionId)
        .then(({ url }) => { window.location.href = url })
        .catch((err: unknown) => {
          setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
          setPhase('error')
        })
      return
    }

    // Logged-in buyer: poll until entitlement is active.
    const userId = session?.user?.id
    if (!userId) return

    pollForEntitlement(userId)
      .then((granted) => setPhase(granted ? 'success' : 'timeout'))
      .catch(() => setPhase('timeout'))
  }, [session, searchParams])

  useEffect(() => {
    if (phase !== 'success') return
    const t = setTimeout(() => navigate('/play', { replace: true }), 3000)
    return () => clearTimeout(t)
  }, [phase, navigate])

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="card w-full max-w-sm text-center space-y-5">
        {phase === 'signing-in' && (
          <>
            <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-ink">Setting up your account</h1>
              <p className="text-sm text-ink-3 mt-1">Just a moment…</p>
            </div>
          </>
        )}

        {phase === 'polling' && (
          <>
            <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-ink">Confirming your subscription</h1>
              <p className="text-sm text-ink-3 mt-1">This usually takes a few seconds…</p>
            </div>
          </>
        )}

        {phase === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-ink">You're all set!</h1>
              <p className="text-sm text-ink-3 mt-1">Redirecting to your lessons…</p>
            </div>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center mx-auto">
              <span className="text-gold font-bold text-xl">!</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">Almost there</h1>
              <p className="text-sm text-ink-3 mt-1">
                Payment received, your access may take a moment to activate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/play', { replace: true })}
              className="btn-primary w-full"
            >
              Go to lessons
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center mx-auto">
              <span className="text-error font-bold text-xl">!</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
              <p className="text-sm text-ink-3 mt-1">{errorMsg || 'Could not sign you in automatically. Please contact support.'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
