import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'

import { useAuth } from '../lib/auth-context'
import { pollForEntitlement } from '../lib/checkout'

type State = 'polling' | 'success' | 'timeout'

export function CheckoutSuccessPage(): JSX.Element {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State>('polling')
  const pollingStarted = useRef(false)

  useEffect(() => {
    if (!session || pollingStarted.current) return
    pollingStarted.current = true

    pollForEntitlement(session.user.id).then((found) => {
      if (found) {
        setState('success')
        setTimeout(() => navigate('/play', { replace: true }), 2000)
      } else {
        setState('timeout')
      }
    })
  }, [session, navigate])

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {state === 'polling' && (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-line border-t-gold animate-spin mx-auto" />
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Confirming your subscription</h1>
              <p className="text-sm text-ink-2">
                This usually takes a few seconds...
              </p>
            </div>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">You're in!</h1>
              <p className="text-sm text-ink-2">Taking you to your lessons...</p>
            </div>
          </>
        )}

        {state === 'timeout' && (
          <>
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Payment received</h1>
              <p className="text-sm text-ink-2">
                Your subscription is being activated. It may take a moment to appear.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/play', { replace: true })}
              className="w-full py-3 rounded-xl bg-gold text-on-gold font-semibold text-sm hover:bg-amber transition-colors"
            >
              Go to lessons
            </button>
          </>
        )}
      </div>
    </div>
  )
}
