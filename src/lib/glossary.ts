import type { GlossaryEntry } from '../../shared/schemas/glossary'
import { supabaseProd } from './supabase-prod'

type GlossaryCache = {
  byTerm: Map<string, GlossaryEntry>
  byId: Map<string, GlossaryEntry>
}

// Module-level cache: one fetch of the published glossary per browser session,
// reused by every GlossaryTerm/drawer instance on the page.
let cachePromise: Promise<GlossaryCache> | null = null

async function loadGlossaryCache(): Promise<GlossaryCache> {
  const { data, error } = await supabaseProd
    .from('content_published')
    .select('content')
    .eq('content_type', 'glossary')

  if (error) throw new Error(error.message)

  const byTerm = new Map<string, GlossaryEntry>()
  const byId = new Map<string, GlossaryEntry>()
  for (const row of data ?? []) {
    const entry = row.content as GlossaryEntry
    if (entry.term) byTerm.set(entry.term.toLowerCase(), entry)
    if (entry.term_id) byId.set(entry.term_id, entry)
  }
  return { byTerm, byId }
}

function getCache(): Promise<GlossaryCache> {
  if (!cachePromise) {
    // Let a failed fetch be retried by the next caller instead of caching the rejection.
    cachePromise = loadGlossaryCache().catch((err: unknown) => {
      cachePromise = null
      throw err
    })
  }
  return cachePromise
}

// glossary_terms in lesson content (shared/schemas/lesson.ts) holds literal term
// text per docs/schema-spec.md "Glossary references" — match on GlossaryEntry.term.
export async function getGlossaryEntryByTerm(
  term: string,
): Promise<GlossaryEntry | null> {
  const cache = await getCache()
  return cache.byTerm.get(term.toLowerCase()) ?? null
}

// related_terms (shared/schemas/glossary.ts) holds term_ids for nested linking.
export async function getGlossaryEntryById(
  termId: string,
): Promise<GlossaryEntry | null> {
  const cache = await getCache()
  return cache.byId.get(termId) ?? null
}
