import { useCallback, useEffect, useRef, useState } from 'react'
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
  // Tracks whether the provider is still mounted so async resolves don't setState
  // after unmount. A ref (not a per-effect local) so the stable resolve callback
  // below can read it too.
  const activeRef = useRef(true)

  // Re-reads the active entitlements for a given session. Stable identity so it
  // can be exposed as refreshEntitlements and depended on by the effect.
  const resolveEntitlements = useCallback(async (current: Session | null): Promise<void> => {
    if (!current) {
      if (activeRef.current) { setIsAdmin(false); setHasAccess(false); setLoading(false) }
      return
    }
    const { data } = await supabaseProd
      .from('entitlements')
      .select('entitlement_key, expires_at')
      .in('entitlement_key', ['admin_access', 'quiz_app_access'])
      .eq('status', 'active')
    if (!activeRef.current) return
    // The database also ignores expired entitlements, so an expired member must
    // not pass the route guard and land on pages that load empty.
    const now = Date.now()
    const keys = (data ?? [])
      .filter((r) => !r.expires_at || new Date(r.expires_at as string).getTime() > now)
      .map((r) => r.entitlement_key as string)
    setIsAdmin(keys.includes('admin_access'))
    setHasAccess(keys.includes('quiz_app_access'))
    setLoading(false)
  }, [])

  // Public hook for callers that know a grant just landed (new-member
  // activation) and need the cached flags refreshed without a reload.
  const refreshEntitlements = useCallback(async (): Promise<void> => {
    await resolveEntitlements(sessionRef.current)
  }, [resolveEntitlements])

  useEffect(() => {
    activeRef.current = true

    supabaseProd.auth.getSession().then(async ({ data }) => {
      if (!activeRef.current) return
      sessionRef.current = data.session
      setSession(data.session)
      await resolveEntitlements(data.session)
      if (activeRef.current) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((event, next) => {
      // INITIAL_SESSION is handled by the getSession() path above.
      //
      // TOKEN_REFRESHED and SIGNED_IN while a session already exists both mean
      // the user is still the same authenticated person - entitlements haven't
      // changed. Skip loading and re-fetch entirely so the page/lesson/wizard
      // stays mounted when the browser fires these events after the user
      // switches browser tabs and comes back.
      if (
        event === 'TOKEN_REFRESHED' ||
        (event === 'SIGNED_IN' && sessionRef.current !== null)
      ) {
        if (activeRef.current) {
          sessionRef.current = next
          setSession(next)
        }
        return
      }
      // For real auth changes (fresh sign-in, sign-out, user update) set
      // loading so RequireAuth/RequireSession waits for entitlements to resolve.
      if (event !== 'INITIAL_SESSION' && activeRef.current) setLoading(true)
      sessionRef.current = next
      setSession(next)
      void resolveEntitlements(next)
    })

    return () => {
      activeRef.current = false
      subscription.unsubscribe()
    }
  }, [resolveEntitlements])

  return (
    <AuthContext.Provider value={{ session, isAdmin, hasAccess, loading, refreshEntitlements }}>
      {children}
    </AuthContext.Provider>
  )
}
