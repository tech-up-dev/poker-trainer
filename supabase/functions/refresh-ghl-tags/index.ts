// Refresh-ghl-tags Edge Function (M5-03).
// Admin-triggered: fetches the location's live GHL tags and caches them so the
// admin per-course "owns this" tag dropdown is fast and survives a GHL outage.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import { getLocationTags } from "../_shared/ghl.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const prod = createClient(url, key);

  try {
    await assertAdmin(req, prod);
  } catch (err) {
    if (err instanceof AdminError) return jsonResponse(req, { ok: false, message: err.message }, err.status);
    throw err;
  }

  let tags: string[];
  try {
    tags = await getLocationTags();
  } catch (_err) {
    // Fail-open: leave the existing cache in place if GHL is unavailable.
    return jsonResponse(req, { ok: false, message: "GHL unavailable; cache unchanged" }, 502);
  }

  await prod
    .from("ghl_tags_cache")
    .update({ tags, refreshed_at: new Date().toISOString() })
    .eq("id", true);

  return jsonResponse(req, { ok: true, count: tags.length });
});
