// Get-from-staging Edge Function.
// Hosted on the production Supabase project. Validates the caller is an admin
// (production auth), then reads a single staged row by content_id + content_type
// using the staging service-role key. Lets the editor's Staging panel show the
// staged copy of an item without the frontend touching the staging DB directly.

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

  let body: { content_id?: unknown; content_type?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const { content_id, content_type } = body;
  if (typeof content_id !== "string" || content_id.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_id is required" }, 400);
  }
  if (typeof content_type !== "string" || content_type.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_type is required" }, 400);
  }

  const staging = createClient(stagingUrl, stagingKey);

  const { data, error } = await staging
    .from("content_staging")
    .select("content")
    .eq("content_id", content_id)
    .eq("content_type", content_type)
    .maybeSingle();

  if (error) {
    return jsonResponse(req, { ok: false, message: error.message }, 500);
  }

  return jsonResponse(req, { ok: true, content: data?.content ?? null });
});
