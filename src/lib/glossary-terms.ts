import { supabaseProd } from './supabase-prod'

// Helpers to fetch the full list of glossary term strings in an environment once,
// so a caller can hand it to save-to-staging / promote-to-prod as a parameter
// (Feature 1/2). That keeps a bulk import to a single glossary read instead of
// one per lesson. If a fetch fails, callers pass undefined and the edge function
// falls back to reading the glossary itself.

type StagingItem = { content_type?: string; content?: { term?: unknown } }

// Every term currently in STAGING, via the list-from-staging edge function.
export async function fetchStagingGlossaryTerms(): Promise<string[]> {
  const { data, error } = await supabaseProd.functions.invoke('list-from-staging', {
    body: {},
  })
  if (error) throw new Error(error.message)
  const result = data as { ok: boolean; items?: StagingItem[]; message?: string }
  if (!result.ok) throw new Error(result.message ?? 'Failed to list staging content')
  return (result.items ?? [])
    .filter((i) => i.content_type === 'glossary')
    .map((i) => i.content?.term)
    .filter((t): t is string => typeof t === 'string')
}

// Every term currently PUBLISHED in production (read directly, RLS allows it).
export async function fetchProdGlossaryTerms(): Promise<string[]> {
  const { data, error } = await supabaseProd
    .from('content_published')
    .select('content')
    .eq('content_type', 'glossary')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { content: { term?: unknown } }[])
    .map((r) => r.content?.term)
    .filter((t): t is string => typeof t === 'string')
}
