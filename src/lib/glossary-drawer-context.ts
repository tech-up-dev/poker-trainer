import { createContext, useContext } from 'react'

export type GlossaryDrawerContextValue = {
  openTerm: (term: string) => void
  pushRelatedTerm: (termId: string) => void
  back: () => void
  close: () => void
}

export const GlossaryDrawerContext =
  createContext<GlossaryDrawerContextValue | null>(null)

export function useGlossaryDrawer(): GlossaryDrawerContextValue {
  const ctx = useContext(GlossaryDrawerContext)
  if (!ctx) {
    throw new Error('useGlossaryDrawer must be used within GlossaryDrawerProvider')
  }
  return ctx
}
