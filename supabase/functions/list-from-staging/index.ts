// List-from-staging Edge Function.
// Hosted on the production Supabase project. Validates the caller is an admin
// (production auth), then reads the staging content buffer using the staging
// service-role key. The frontend can't touch the staging DB directly, so this
// is how the Staging browser sees what's been saved but not yet promoted.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const stagingUrl = Deno.env.get("STAGING_SUPABASE_URL");
  const stagingKey = Deno.env.get("STAGING_SUPABASE_SERVICE_ROLE_KEY");
  const prodUrl    = Deno.env.get("SUPABASE_URL");
  const prodKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stagingUrl || !stagingKey || !prodUrl || !prodKey) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const prod = createClient(prodUrl, prodKey);

  try {
    await assertAdmin(req, prod);
  } catch (err) {
    if (err instanceof AdminError) {
      return jsonResponse(req, { ok: false, message: err.message }, err.status);
    }
    throw err;
  }

  const staging = createClient(stagingUrl, stagingKey);

  const { data, error } = await staging
    .from("content_staging")
    .select("content_id, content_type, content, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return jsonResponse(req, { ok: false, message: error.message }, 500);
  }

  return jsonResponse(req, { ok: true, items: data ?? [] });
});
