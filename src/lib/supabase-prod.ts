import { createClient } from '@supabase/supabase-js'

// Client pointing at the production Supabase project.
// All admin auth, Edge Function calls, and published content reads go through here.
// Staging DB is only accessed server-side via Edge Function service-role keys.
export const supabaseProd = createClient(
  import.meta.env.VITE_SUPABASE_PROD_URL,
  import.meta.env.VITE_SUPABASE_PROD_ANON_KEY,
)
