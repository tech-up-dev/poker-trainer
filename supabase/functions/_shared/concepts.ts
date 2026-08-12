import { createClient } from "jsr:@supabase/supabase-js@2";

type Client = ReturnType<typeof createClient>;

// The managed concept vocabulary as a set of slugs, for validating a question's
// concept tag (M3-09). Read against the production project: concepts are global
// app metadata (like entitlements/app_settings), the single source of truth the
// admin screen writes to, so content in either environment validates against it.
export async function fetchValidConcepts(client: Client): Promise<Set<string>> {
  const { data } = await client.from("concepts").select("slug");
  return new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
}
