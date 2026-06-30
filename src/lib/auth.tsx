import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabaseProd } from './supabase-prod'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // RLS scopes this to the current user's rows, so a returned row means the
    // signed-in user is the admin.
    async function resolveAdmin(current: Session | null): Promise<void> {
      if (!current) {
        if (active) setIsAdmin(false)
        return
      }
      const { data } = await supabaseProd
        .from('entitlements')
        .select('entitlement_key')
        .eq('entitlement_key', 'admin_access')
        .eq('status', 'active')
        .maybeSingle()
      if (active) setIsAdmin(data !== null)
    }

    supabaseProd.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await resolveAdmin(data.session)
      if (active) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void resolveAdmin(next)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, isAdmin, loading }}>{children}</AuthContext.Provider>
  )
}
