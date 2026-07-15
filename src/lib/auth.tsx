import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabaseProd } from './supabase-prod'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)

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
      setSession(data.session)
      await resolveEntitlements(data.session)
      if (active) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((event, next) => {
      // INITIAL_SESSION is handled by the getSession() path above.
      // TOKEN_REFRESHED only rotates the JWT — entitlements don't change, so
      // we skip the loading flag and the entitlement re-fetch entirely. This
      // prevents the lesson/page from unmounting mid-session when the browser
      // fires a background token refresh after the user switches tabs.
      if (event === 'TOKEN_REFRESHED') {
        if (active) setSession(next)
        return
      }
      // For real auth changes (sign-in, sign-out, user update) set loading so
      // RequireAuth/RequireSession waits until entitlements are resolved.
      if (event !== 'INITIAL_SESSION' && active) setLoading(true)
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
