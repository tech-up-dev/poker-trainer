// Save-to-staging Edge Function.
// Hosted on the production Supabase project. Validates the caller is an admin
// (production auth), then writes/upserts the content row to the staging DB
// using the staging service-role key. The frontend never touches the staging
// DB directly — all staging writes go through here.

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

  let body: { content_id?: unknown; content_type?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const { content_id, content_type, content } = body;
  if (typeof content_id !== "string" || content_id.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_id is required" }, 400);
  }
  if (typeof content_type !== "string" || content_type.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_type is required" }, 400);
  }
  if (content === undefined || content === null) {
    return jsonResponse(req, { ok: false, message: "content is required" }, 400);
  }

  const staging = createClient(stagingUrl, stagingKey);

  const { error } = await staging.from("content_staging").upsert({
    content_id,
    content_type,
    content,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return jsonResponse(req, { ok: false, message: error.message }, 500);
  }

  return jsonResponse(req, { ok: true, content_id, content_type });
});
