import type { ReactNode } from 'react'

import { GlossaryTerm } from '../components/GlossaryTerm'

// Wraps every occurrence of each glossary_terms entry inside `text` with a
// tappable <GlossaryTerm>. Per docs/schema-spec.md "Glossary references":
// glossary_terms is the explicit allow-list, only listed terms get linked,
// the app does not auto-link arbitrary words.
export function linkifyGlossaryTerms(
  text: string,
  terms: string[] | undefined,
): ReactNode {
  if (!terms || terms.length === 0) return text

  // Longest-first so e.g. "fold equity" matches before "equity" would.
  const sortedTerms = [...terms].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(
    `(${sortedTerms.map(escapeRegExp).join('|')})`,
    'gi',
  )
  const parts = text.split(pattern)

  return parts.map((part, i) => {
    const isMatch = sortedTerms.some(
      (term) => term.toLowerCase() === part.toLowerCase(),
    )
    if (!isMatch) return part
    return (
      <GlossaryTerm key={`${part}-${i}`} term={part}>
        {part}
      </GlossaryTerm>
    )
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
