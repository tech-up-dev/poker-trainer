// Promote-to-prod Edge Function.
// Hosted in the production Supabase project. Reads a row from the staging
// project's lessons_staging, re-validates it, appends a new version snapshot to
// prod's lesson_versions, and upserts prod's lessons_published with
// current_version pointing at the new snapshot.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import { revalidateLesson } from "../_shared/validate-content.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflight(req);
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const stagingUrl = Deno.env.get("STAGING_SUPABASE_URL");
  const stagingKey = Deno.env.get("STAGING_SUPABASE_SERVICE_ROLE_KEY");
  const prodUrl = Deno.env.get("SUPABASE_URL");
  const prodKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stagingUrl || !stagingKey || !prodUrl || !prodKey) {
    return jsonResponse(
      req,
      { ok: false, message: "Missing required environment variables" },
      500
    );
  }

  const staging = createClient(stagingUrl, stagingKey);
  const prod = createClient(prodUrl, prodKey);

  // Admin gate. No-op unless REQUIRE_ADMIN is enabled (see _shared/admin.ts).
  try {
    await assertAdmin(req, prod);
  } catch (err) {
    if (err instanceof AdminError) {
      return jsonResponse(req, { ok: false, message: err.message }, err.status);
    }
    throw err;
  }

  let body: { lesson_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const lessonId = body.lesson_id;
  if (typeof lessonId !== "string" || lessonId.length === 0) {
    return jsonResponse(req, { ok: false, message: "lesson_id is required" }, 400);
  }

  // 1. Read row from staging.
  const { data: stagingRow, error: stagingErr } = await staging
    .from("lessons_staging")
    .select("content")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (stagingErr) {
    return jsonResponse(req, { ok: false, message: stagingErr.message }, 500);
  }
  if (!stagingRow) {
    return jsonResponse(
      req,
      { ok: false, message: "Lesson not found in staging" },
      404
    );
  }

  // 2. Re-validate before anything touches production. This is the real gate;
  // client-side validation can be bypassed by writing to staging directly.
  const revalidation = revalidateLesson(stagingRow.content);
  if (!revalidation.ok) {
    return jsonResponse(
      req,
      {
        ok: false,
        message: "Staged content failed server-side validation",
        errors: revalidation.errors,
      },
      422
    );
  }

  // 3. Compute next version_number for this lesson in prod.
  const { data: maxRow, error: maxErr } = await prod
    .from("lesson_versions")
    .select("version_number")
    .eq("lesson_id", lessonId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    return jsonResponse(req, { ok: false, message: maxErr.message }, 500);
  }

  const nextVersion = (maxRow?.version_number ?? 0) + 1;

  // 4. Insert the version snapshot.
  const { error: insertErr } = await prod.from("lesson_versions").insert({
    lesson_id: lessonId,
    version_number: nextVersion,
    content: stagingRow.content,
    created_by: "promote",
    source_version: null,
  });

  if (insertErr) {
    return jsonResponse(req, { ok: false, message: insertErr.message }, 500);
  }

  // 5. Upsert lessons_published with the new current_version.
  const { error: upsertErr } = await prod.from("lessons_published").upsert({
    lesson_id: lessonId,
    content: stagingRow.content,
    current_version: nextVersion,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    return jsonResponse(req, { ok: false, message: upsertErr.message }, 500);
  }

  return jsonResponse(req, {
    ok: true,
    lesson_id: lessonId,
    version_number: nextVersion,
  });
});
