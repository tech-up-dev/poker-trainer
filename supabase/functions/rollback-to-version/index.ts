// Rollback-to-version Edge Function.
// Production-only operation: reads the target version's snapshot from
// content_versions, writes a new version entry (created_by="rollback",
// source_version=<target>), and upserts content_published to point at it.
// Append-only; no prior versions are ever deleted.
//
// Like promote, rollback re-validates the target snapshot against the current
// Zod schema before it can reach production (issue #23). Nothing goes live
// without passing the real gate, even on a restore. If a schema change has made
// an old snapshot invalid, the rollback is refused with the field errors so the
// content can be fixed and re-promoted rather than silently shipping bad data.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import { revalidateContent } from "../_shared/validate-content.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const prodUrl = Deno.env.get("SUPABASE_URL");
  const prodKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!prodUrl || !prodKey) {
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

  let body: { content_id?: unknown; content_type?: unknown; target_version?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const { content_id, content_type, target_version } = body;
  if (typeof content_id !== "string" || content_id.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_id is required" }, 400);
  }
  if (typeof content_type !== "string" || content_type.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_type is required" }, 400);
  }
  if (typeof target_version !== "number" || !Number.isInteger(target_version) || target_version < 1) {
    return jsonResponse(req, { ok: false, message: "target_version must be a positive integer" }, 400);
  }

  // 1. Look up the target version.
  const { data: target, error: targetErr } = await prod
    .from("content_versions")
    .select("content")
    .eq("content_id", content_id)
    .eq("content_type", content_type)
    .eq("version_number", target_version)
    .maybeSingle();

  if (targetErr) {
    return jsonResponse(req, { ok: false, message: targetErr.message }, 500);
  }
  if (!target) {
    return jsonResponse(req, {
      ok: false,
      message: `Version ${target_version} not found for ${content_type}:${content_id}`,
    }, 404);
  }

  // 1b. Re-validate the target snapshot against the current schema (issue #23).
  // The final gate: a restore must still pass validation to reach production.
  const check = revalidateContent(content_type, target.content);
  if (!check.ok) {
    return jsonResponse(req, {
      ok: false,
      message:
        `Version ${target_version} no longer passes validation: ` +
        check.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
      errors: check.errors,
    }, 422);
  }

  // 2. Compute next version_number.
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

  // 3. Append the rollback snapshot.
  const { error: insertErr } = await prod.from("content_versions").insert({
    content_id,
    content_type,
    version_number: nextVersion,
    content: target.content,
    created_by: "rollback",
    source_version: target_version,
  });

  if (insertErr) {
    return jsonResponse(req, { ok: false, message: insertErr.message }, 500);
  }

  // 4. Upsert content_published with the rolled-back content.
  const { error: upsertErr } = await prod.from("content_published").upsert({
    content_id,
    content_type,
    content: target.content,
    current_version: nextVersion,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    return jsonResponse(req, { ok: false, message: upsertErr.message }, 500);
  }

  return jsonResponse(req, {
    ok: true,
    content_id,
    content_type,
    version_number: nextVersion,
    rolled_back_from: target_version,
  });
});
