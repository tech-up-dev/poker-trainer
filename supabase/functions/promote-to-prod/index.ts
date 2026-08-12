// Promote-to-prod Edge Function.
// Hosted on the production Supabase project. Reads a row from the staging
// project's content_staging, re-validates it, appends a new version snapshot
// to prod's content_versions, and upserts content_published.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import { revalidateContent } from "../_shared/validate-content.ts";
import { applyGlossaryLinks } from "../../../shared/utils/glossary-linking.ts";
import { relinkChangedLessons } from "../_shared/glossary-backfill.ts";
import type { Lesson } from "../../../shared/schemas/lesson.ts";

type ProdClient = ReturnType<typeof createClient>;

// After a glossary is promoted, re-link every PUBLISHED lesson against the prod
// glossary (Feature 2). Updates content_published in place - glossary_terms is
// derived data, so this deliberately does not cut a new version per lesson (that
// would bloat content_versions); the next real promote re-snapshots them anyway.
// Best-effort so a backfill hiccup never fails the glossary promote itself.
async function backfillPublishedLessons(prod: ProdClient): Promise<number> {
  try {
    const terms = await resolveProdGlossaryTerms(prod, undefined);
    const { data } = await prod
      .from("content_published")
      .select("content_id, content")
      .eq("content_type", "lesson");
    const rows = ((data ?? []) as { content_id: string; content: Lesson }[]).map((r) => ({
      content_id: r.content_id,
      content: r.content,
    }));
    const changed = relinkChangedLessons(rows, terms);
    for (const row of changed) {
      await prod
        .from("content_published")
        .update({ content: row.content, updated_at: new Date().toISOString() })
        .eq("content_id", row.content_id)
        .eq("content_type", "lesson");
    }
    return changed.length;
  } catch {
    return 0;
  }
}

// Production glossary terms to re-link a promoted lesson against, so the
// published copy reflects the prod glossary (which can differ from staging). The
// caller may pass the list; otherwise read every published glossary term.
async function resolveProdGlossaryTerms(
  prod: ProdClient,
  provided: unknown,
): Promise<string[]> {
  if (Array.isArray(provided)) {
    return provided.filter((t): t is string => typeof t === "string");
  }
  const { data } = await prod
    .from("content_published")
    .select("content")
    .eq("content_type", "glossary");
  return ((data ?? []) as { content: { term?: unknown } }[])
    .map((r) => r.content?.term)
    .filter((t): t is string => typeof t === "string");
}

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

  let body: { content_id?: unknown; content_type?: unknown; glossary_terms?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const { content_id, content_type, glossary_terms } = body;
  if (typeof content_id !== "string" || content_id.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_id is required" }, 400);
  }
  if (typeof content_type !== "string" || content_type.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_type is required" }, 400);
  }

  // 1. Read row from staging.
  const { data: stagingRow, error: stagingErr } = await staging
    .from("content_staging")
    .select("content, seq")
    .eq("content_id", content_id)
    .eq("content_type", content_type)
    .maybeSingle();

  if (stagingErr) {
    return jsonResponse(req, { ok: false, message: stagingErr.message }, 500);
  }
  if (!stagingRow) {
    return jsonResponse(req, { ok: false, message: "Content not found in staging" }, 404);
  }

  // 2. Re-link a lesson's glossary terms against the PRODUCTION glossary before
  // publishing, so the live copy matches prod (Feature 1, "apply it upstream too").
  let contentToPublish = stagingRow.content;
  if (content_type === "lesson") {
    const terms = await resolveProdGlossaryTerms(prod, glossary_terms);
    contentToPublish = applyGlossaryLinks(stagingRow.content as Lesson, terms);
  }

  // 3. Re-validate exactly what we are about to publish.
  const revalidation = revalidateContent(content_type, contentToPublish);
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

  // The staging row's permanent sequence number (M3-15) rides along to prod
  // unchanged, so a published item and its versions share the number it was first
  // assigned in save-to-staging.
  const seq = typeof stagingRow.seq === "number" ? stagingRow.seq : null;

  // 4. Insert the version snapshot.
  const { error: insertErr } = await prod.from("content_versions").insert({
    content_id,
    content_type,
    version_number: nextVersion,
    content: contentToPublish,
    seq,
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
    content: contentToPublish,
    current_version: nextVersion,
    seq,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    return jsonResponse(req, { ok: false, message: upsertErr.message }, 500);
  }

  // Promoting a glossary term re-links every published lesson (Feature 2).
  const relinked = content_type === "glossary" ? await backfillPublishedLessons(prod) : 0;

  return jsonResponse(req, { ok: true, content_id, content_type, version_number: nextVersion, relinked });
});
