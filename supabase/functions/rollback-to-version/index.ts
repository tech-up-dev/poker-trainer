// Rollback-to-version Edge Function.
// Hosted in the production Supabase project. Production-only operation:
// reads the target version's snapshot from prod's lesson_versions, writes
// a new version entry whose content matches the target (created_by="rollback",
// source_version=<target>), and upserts lessons_published to point at it.
// The history is append-only; rollback never deletes prior versions.

import { createClient } from "jsr:@supabase/supabase-js@2";

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

  const prodUrl = Deno.env.get("SUPABASE_URL");
  const prodKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!prodUrl || !prodKey) {
    return jsonResponse(
      { ok: false, message: "Missing required environment variables" },
      500
    );
  }

  let body: { lesson_id?: unknown; target_version?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON body" }, 400);
  }

  const lessonId = body.lesson_id;
  const targetVersion = body.target_version;
  if (typeof lessonId !== "string" || lessonId.length === 0) {
    return jsonResponse({ ok: false, message: "lesson_id is required" }, 400);
  }
  if (
    typeof targetVersion !== "number" ||
    !Number.isInteger(targetVersion) ||
    targetVersion < 1
  ) {
    return jsonResponse(
      { ok: false, message: "target_version must be a positive integer" },
      400
    );
  }

  const prod = createClient(prodUrl, prodKey);

  // 1. Look up the target version.
  const { data: target, error: targetErr } = await prod
    .from("lesson_versions")
    .select("content")
    .eq("lesson_id", lessonId)
    .eq("version_number", targetVersion)
    .maybeSingle();

  if (targetErr) {
    return jsonResponse({ ok: false, message: targetErr.message }, 500);
  }
  if (!target) {
    return jsonResponse(
      {
        ok: false,
        message: `Version ${targetVersion} not found for lesson_id ${lessonId}`,
      },
      404
    );
  }

  // 2. Compute next version_number for this lesson.
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

  // 3. Append the rollback snapshot.
  const { error: insertErr } = await prod.from("lesson_versions").insert({
    lesson_id: lessonId,
    version_number: nextVersion,
    content: target.content,
    created_by: "rollback",
    source_version: targetVersion,
  });

  if (insertErr) {
    return jsonResponse({ ok: false, message: insertErr.message }, 500);
  }

  // 4. Upsert lessons_published with the rolled-back content.
  const { error: upsertErr } = await prod.from("lessons_published").upsert({
    lesson_id: lessonId,
    content: target.content,
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
    rolled_back_from: targetVersion,
  });
});
