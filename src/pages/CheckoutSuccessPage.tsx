import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { useAuth } from '../lib/auth-context'
import { pollForEntitlement } from '../lib/checkout'

type Phase = 'polling' | 'success' | 'timeout'

export function CheckoutSuccessPage(): JSX.Element {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('polling')

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    pollForEntitlement(userId)
      .then((granted) => setPhase(granted ? 'success' : 'timeout'))
      .catch(() => setPhase('timeout'))
  }, [session])

  useEffect(() => {
    if (phase !== 'success') return
    const t = setTimeout(() => navigate('/play', { replace: true }), 3000)
    return () => clearTimeout(t)
  }, [phase, navigate])

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="card w-full max-w-sm text-center space-y-5">
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
                Payment received — your access may take a moment to activate.
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
      </div>
    </div>
  )
}
