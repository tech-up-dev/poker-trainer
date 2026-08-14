// Reassign-concept Edge Function (M3-10, content model spec).
// Hosted on the production Supabase project. Powers the "reassign then delete"
// flow for the concept vocabulary: retag every question tagged with one concept
// onto another, across both the staging buffer and published content, then soft-
// delete the source concept (stamp deleted_at) so the vocabulary drops it while
// historical answer events can still resolve its name.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";

type Client = ReturnType<typeof createClient>;

// Retag questions from one concept slug to another in a content table, writing
// back only lessons that changed. Returns how many questions were retagged.
async function retagLessons(client: Client, table: string, fromSlug: string, toSlug: string): Promise<number> {
  const { data } = await client.from(table).select("content_id, content").eq("content_type", "lesson");
  let retagged = 0;
  for (const row of (data ?? []) as { content_id: string; content: Record<string, unknown> }[]) {
    const lesson = row.content;
    const questions = (lesson?.questions ?? []) as Record<string, unknown>[];
    let changed = false;
    for (const q of questions) {
      if (q.concept === fromSlug) {
        q.concept = toSlug;
        retagged++;
        changed = true;
      }
    }
    if (changed) {
      await client
        .from(table)
        .update({ content: lesson, updated_at: new Date().toISOString() })
        .eq("content_id", row.content_id)
        .eq("content_type", "lesson");
    }
  }
  return retagged;
}

async function activeConcept(prod: Client, slug: string): Promise<boolean> {
  const { data } = await prod.from("concepts").select("slug").eq("slug", slug).is("deleted_at", null).maybeSingle();
  return Boolean(data);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const stagingUrl = Deno.env.get("STAGING_SUPABASE_URL");
  const stagingKey = Deno.env.get("STAGING_SUPABASE_SERVICE_ROLE_KEY");
  const prodUrl = Deno.env.get("SUPABASE_URL");
  const prodKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stagingUrl || !stagingKey || !prodUrl || !prodKey) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const prod = createClient(prodUrl, prodKey);

  try {
    await assertAdmin(req, prod);
  } catch (err) {
    if (err instanceof AdminError) return jsonResponse(req, { ok: false, message: err.message }, err.status);
    throw err;
  }

  let body: { from_slug?: unknown; to_slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const fromSlug = typeof body.from_slug === "string" ? body.from_slug : "";
  const toSlug = typeof body.to_slug === "string" ? body.to_slug : "";
  if (!fromSlug || !toSlug) {
    return jsonResponse(req, { ok: false, message: "from_slug and to_slug are required" }, 400);
  }
  if (fromSlug === toSlug) {
    return jsonResponse(req, { ok: false, message: "from_slug and to_slug must differ" }, 400);
  }
  if (!(await activeConcept(prod, fromSlug))) {
    return jsonResponse(req, { ok: false, message: `Unknown or already-deleted concept: ${fromSlug}` }, 400);
  }
  if (!(await activeConcept(prod, toSlug))) {
    return jsonResponse(req, { ok: false, message: `Reassign target is not an active concept: ${toSlug}` }, 400);
  }

  const staging = createClient(stagingUrl, stagingKey);

  const retaggedStaging = await retagLessons(staging, "content_staging", fromSlug, toSlug);
  const retaggedPublished = await retagLessons(prod, "content_published", fromSlug, toSlug);

  // Soft-delete the source concept in both environments' vocabularies.
  const now = new Date().toISOString();
  await prod.from("concepts").update({ deleted_at: now }).eq("slug", fromSlug);
  await staging.from("concepts").update({ deleted_at: now }).eq("slug", fromSlug);

  return jsonResponse(req, {
    ok: true,
    from_slug: fromSlug,
    to_slug: toSlug,
    retagged_staging: retaggedStaging,
    retagged_published: retaggedPublished,
  });
});
