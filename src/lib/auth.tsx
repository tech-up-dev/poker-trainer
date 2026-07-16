import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabaseProd } from './supabase-prod'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  // Ref so the auth state change closure can read the current session without
  // being stale (useState values captured at subscription time don't update).
  const sessionRef = useRef<Session | null>(null)

  useEffect(() => {
    let active = true

    async function resolveEntitlements(current: Session | null): Promise<void> {
      if (!current) {
        if (active) { setIsAdmin(false); setHasAccess(false); setLoading(false) }
        return
      }
      const { data } = await supabaseProd
        .from('entitlements')
        .select('entitlement_key')
        .in('entitlement_key', ['admin_access', 'quiz_app_access'])
        .eq('status', 'active')
      if (!active) return
      const keys = (data ?? []).map((r) => r.entitlement_key as string)
      setIsAdmin(keys.includes('admin_access'))
      setHasAccess(keys.includes('quiz_app_access'))
      setLoading(false)
    }

    supabaseProd.auth.getSession().then(async ({ data }) => {
      if (!active) return
      sessionRef.current = data.session
      setSession(data.session)
      await resolveEntitlements(data.session)
      if (active) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((event, next) => {
      // INITIAL_SESSION is handled by the getSession() path above.
      //
      // TOKEN_REFRESHED and SIGNED_IN while a session already exists both mean
      // the user is still the same authenticated person — entitlements haven't
      // changed. Skip loading and re-fetch entirely so the page/lesson/wizard
      // stays mounted when the browser fires these events after the user
      // switches browser tabs and comes back.
      if (
        event === 'TOKEN_REFRESHED' ||
        (event === 'SIGNED_IN' && sessionRef.current !== null)
      ) {
        if (active) {
          sessionRef.current = next
          setSession(next)
        }
        return
      }
      // For real auth changes (fresh sign-in, sign-out, user update) set
      // loading so RequireAuth/RequireSession waits for entitlements to resolve.
      if (event !== 'INITIAL_SESSION' && active) setLoading(true)
      sessionRef.current = next
      setSession(next)
      void resolveEntitlements(next)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, isAdmin, hasAccess, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
