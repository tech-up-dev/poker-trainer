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
  // inside "3-betting" - the term must not be immediately preceded or followed
  // by a word character or hyphen.
  const pattern = new RegExp(
    `(?<![\\w-])(${sortedTerms.map(escapeRegExp).join('|')})(?![\\w-])`,
    'gi',
  )
  const parts = text.split(pattern)

  // Only link the first occurrence of each term within this content area.
  const linked = new Set<string>()

  const result: ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const matchedTerm = sortedTerms.find(
      (term) => term.toLowerCase() === part.toLowerCase(),
    )
    if (!matchedTerm) {
      result.push(part)
      continue
    }
    const key = matchedTerm.toLowerCase()
    if (linked.has(key)) {
      result.push(part)
      continue
    }
    linked.add(key)

    // Steal any opening punctuation from the already-rendered previous text node
    // and any closing punctuation from the next part, so they stay on the same
    // line as the linked term (prevents orphaned "(" or ")" on mobile).
    let leading = ''
    const prev = result[result.length - 1]
    if (typeof prev === 'string' && /[(\["']$/.test(prev)) {
      leading = prev.slice(-1)
      result[result.length - 1] = prev.slice(0, -1)
    }

    let trailing = ''
    const next = parts[i + 1]
    if (next !== undefined) {
      const m = /^[)\].,;:!?"']/.exec(next)
      if (m) {
        trailing = m[0]
        parts[i + 1] = next.slice(trailing.length)
      }
    }

    result.push(
      leading || trailing
        ? (
          <span key={`${part}-${i}`} style={{ whiteSpace: 'nowrap' }}>
            {leading}
            <GlossaryTerm term={part}>{part}</GlossaryTerm>
            {trailing}
          </span>
        )
        : (
          <GlossaryTerm key={`${part}-${i}`} term={part}>
            {part}
          </GlossaryTerm>
        ),
    )
  }
  return result
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
