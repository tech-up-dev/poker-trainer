import { createClient } from '@supabase/supabase-js'

// Read-only client pointing at the production Supabase project.
// Used by the versions panel and to invoke prod-hosted Edge Functions
// (promote-to-prod, rollback-to-version). The staging client in
// src/lib/supabase.ts remains the single writer for lessons_staging.
export const supabaseProd = createClient(
  import.meta.env.VITE_SUPABASE_PROD_URL,
  import.meta.env.VITE_SUPABASE_PROD_ANON_KEY,
)
