import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// #77 / audit F-013: per-IP rate limit for the anonymous Edge Functions.
// Counts live in edge_rate_limits (see migration 20261016150000), which only the
// service role can reach, so pass a service-role client.
//
// Fail-open: if the check itself errors, the request is allowed. A database
// hiccup must never block a real purchase.
export async function allowRequest(
  client: SupabaseClient,
  endpoint: string,
  req: Request,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const { data, error } = await client.rpc("edge_rate_limit_hit", {
    p_bucket: `${endpoint}:${ip}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data !== false;
}
