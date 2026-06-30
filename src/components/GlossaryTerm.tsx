import type { JSX, ReactNode } from 'react'

import { useGlossaryDrawer } from './GlossaryDrawer'

type GlossaryTermProps = {
  // Term text as listed in a question's glossary_terms array (shared/schemas/lesson.ts).
  // Looked up against GlossaryEntry.term — see src/lib/glossary.ts.
  term: string
  children?: ReactNode
}

// Tappable glossary term for use in question prompts, explanations, and
// takeaways. Opens the shared GlossaryDrawer (must be inside GlossaryDrawerProvider).
export function GlossaryTerm({ term, children }: GlossaryTermProps): JSX.Element {
  const { openTerm } = useGlossaryDrawer()

  return (
    <button
      type="button"
      onClick={() => openTerm(term)}
      className="font-medium text-link underline decoration-dotted underline-offset-2"
    >
      {children ?? term}
    </button>
  )
}
