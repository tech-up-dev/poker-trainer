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
        if (active) { setIsAdmin(false); setHasAccess(false) }
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
    }

    supabaseProd.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await resolveEntitlements(data.session)
      if (active) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((_event, next) => {
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
