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
  // Use lookahead/lookbehind instead of \b so that terms with hyphens (e.g.
  // "3-bet") are still bounded correctly. This prevents "3-bet" from matching
  // inside "3-betting" — the term must not be immediately preceded or followed
  // by a word character or hyphen.
  const pattern = new RegExp(
    `(?<![\\w-])(${sortedTerms.map(escapeRegExp).join('|')})(?![\\w-])`,
    'gi',
  )
  const parts = text.split(pattern)

  // Only link the first occurrence of each term within this content area.
  const linked = new Set<string>()

  return parts.map((part, i) => {
    const matchedTerm = sortedTerms.find(
      (term) => term.toLowerCase() === part.toLowerCase(),
    )
    if (!matchedTerm) return part
    const key = matchedTerm.toLowerCase()
    if (linked.has(key)) return part
    linked.add(key)
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
