import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState = {
  session: Session | null
  // Whether the signed-in user holds an active admin_access entitlement. The
  // database (RLS) is the real gate; this just keeps non-admins out of the CMS UI.
  isAdmin: boolean
  // Whether the signed-in user holds an active quiz_app_access entitlement.
  // Gates all /play/* member routes. RLS is the real gate; this drives the UI redirect.
  hasAccess: boolean
  loading: boolean
}

export const AuthContext = createContext<AuthState>({
  session: null,
  isAdmin: false,
  hasAccess: false,
  loading: true,
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
