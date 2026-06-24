// Promote-to-prod Edge Function.
// Hosted on the production Supabase project. Reads a row from the staging
// project's content_staging, re-validates it, appends a new version snapshot
// to prod's content_versions, and upserts content_published.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import { revalidateContent } from "../_shared/validate-content.ts";

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

  const staging = createClient(stagingUrl, stagingKey);
  const prod    = createClient(prodUrl, prodKey);

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

  // 1. Read row from staging.
  const { data: stagingRow, error: stagingErr } = await staging
    .from("content_staging")
    .select("content")
    .eq("content_id", content_id)
    .eq("content_type", content_type)
    .maybeSingle();

  if (stagingErr) {
    return jsonResponse(req, { ok: false, message: stagingErr.message }, 500);
  }
  if (!stagingRow) {
    return jsonResponse(req, { ok: false, message: "Content not found in staging" }, 404);
  }

  // 2. Re-validate before anything touches production.
  const revalidation = revalidateContent(content_type, stagingRow.content);
  if (!revalidation.ok) {
    return jsonResponse(req, {
      ok: false,
      message: "Staged content failed server-side validation",
      errors: revalidation.errors,
    }, 422);
  }

  // 3. Compute next version_number for this content item in prod.
  const { data: maxRow, error: maxErr } = await prod
    .from("content_versions")
    .select("version_number")
    .eq("content_id", content_id)
    .eq("content_type", content_type)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    return jsonResponse(req, { ok: false, message: maxErr.message }, 500);
  }

  const nextVersion = (maxRow?.version_number ?? 0) + 1;

  // 4. Insert the version snapshot.
  const { error: insertErr } = await prod.from("content_versions").insert({
    content_id,
    content_type,
    version_number: nextVersion,
    content: stagingRow.content,
    created_by: "promote",
    source_version: null,
  });

  if (insertErr) {
    return jsonResponse(req, { ok: false, message: insertErr.message }, 500);
  }

  // 5. Upsert content_published.
  const { error: upsertErr } = await prod.from("content_published").upsert({
    content_id,
    content_type,
    content: stagingRow.content,
    current_version: nextVersion,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    return jsonResponse(req, { ok: false, message: upsertErr.message }, 500);
  }

  return jsonResponse(req, { ok: true, content_id, content_type, version_number: nextVersion });
});
