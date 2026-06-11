// Promote-to-prod Edge Function.
// Hosted in the production Supabase project. Reads a row from the staging
// project's lessons_staging, appends a new version snapshot to prod's
// lesson_versions, and upserts prod's lessons_published with current_version
// pointing at the new snapshot.
//
// Note: server-side re-validation against the Zod schema is deferred to V1.
// For the paid test, client-side validation in the React app is sufficient
// before a row reaches lessons_staging.

import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS: wildcard for the test; restrict to the Vercel preview/prod domains
// before V1 by replacing the "*" with an explicit allow-list.
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
  }

  const stagingUrl = Deno.env.get("STAGING_SUPABASE_URL");
  const stagingKey = Deno.env.get("STAGING_SUPABASE_SERVICE_ROLE_KEY");
  const prodUrl = Deno.env.get("SUPABASE_URL");
  const prodKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stagingUrl || !stagingKey || !prodUrl || !prodKey) {
    return jsonResponse(
      { ok: false, message: "Missing required environment variables" },
      500
    );
  }

  let body: { lesson_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON body" }, 400);
  }

  const lessonId = body.lesson_id;
  if (typeof lessonId !== "string" || lessonId.length === 0) {
    return jsonResponse({ ok: false, message: "lesson_id is required" }, 400);
  }

  const staging = createClient(stagingUrl, stagingKey);
  const prod = createClient(prodUrl, prodKey);

  // 1. Read row from staging.
  const { data: stagingRow, error: stagingErr } = await staging
    .from("lessons_staging")
    .select("content")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (stagingErr) {
    return jsonResponse({ ok: false, message: stagingErr.message }, 500);
  }
  if (!stagingRow) {
    return jsonResponse(
      { ok: false, message: "Lesson not found in staging" },
      404
    );
  }

  // 2. Compute next version_number for this lesson in prod.
  const { data: maxRow, error: maxErr } = await prod
    .from("lesson_versions")
    .select("version_number")
    .eq("lesson_id", lessonId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    return jsonResponse({ ok: false, message: maxErr.message }, 500);
  }

  const nextVersion = (maxRow?.version_number ?? 0) + 1;

  // 3. Insert the version snapshot.
  const { error: insertErr } = await prod.from("lesson_versions").insert({
    lesson_id: lessonId,
    version_number: nextVersion,
    content: stagingRow.content,
    created_by: "promote",
    source_version: null,
  });

  if (insertErr) {
    return jsonResponse({ ok: false, message: insertErr.message }, 500);
  }

  // 4. Upsert lessons_published with the new current_version.
  const { error: upsertErr } = await prod.from("lessons_published").upsert({
    lesson_id: lessonId,
    content: stagingRow.content,
    current_version: nextVersion,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    return jsonResponse({ ok: false, message: upsertErr.message }, 500);
  }

  return jsonResponse({
    ok: true,
    lesson_id: lessonId,
    version_number: nextVersion,
  });
});
