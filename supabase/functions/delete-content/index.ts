// Delete-content Edge Function.
// Hosted on the production Supabase project. Deletes a content item from BOTH the
// staging buffer and production (content_published) in one call - the delete is
// intentionally not staged. content_versions (append-only history) is left intact.
//
// When a glossary term is deleted, every lesson's glossary_terms is recomputed in
// both environments so the removed term drops out of any lesson that referenced it
// (the delete side of the glossary auto-linking feature).

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import { isContentType } from "../../../shared/schemas/content.ts";
import { relinkChangedLessons } from "../_shared/glossary-backfill.ts";
import type { Lesson } from "../../../shared/schemas/lesson.ts";

type Client = ReturnType<typeof createClient>;

async function glossaryTerms(client: Client, table: string): Promise<string[]> {
  const { data } = await client.from(table).select("content").eq("content_type", "glossary");
  return ((data ?? []) as { content: { term?: unknown } }[])
    .map((r) => r.content?.term)
    .filter((t): t is string => typeof t === "string");
}

// Recompute glossary links across every lesson in one table against its current
// terms, writing back only the lessons that actually changed. Returns the count.
async function relinkLessons(client: Client, table: string): Promise<number> {
  const terms = await glossaryTerms(client, table);
  const { data } = await client.from(table).select("content_id, content").eq("content_type", "lesson");
  const rows = ((data ?? []) as { content_id: string; content: Lesson }[]).map((r) => ({
    content_id: r.content_id,
    content: r.content,
  }));
  const changed = relinkChangedLessons(rows, terms);
  for (const row of changed) {
    await client
      .from(table)
      .update({ content: row.content, updated_at: new Date().toISOString() })
      .eq("content_id", row.content_id)
      .eq("content_type", "lesson");
  }
  return changed.length;
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
    if (err instanceof AdminError) {
      return jsonResponse(req, { ok: false, message: err.message }, err.status);
    }
    throw err;
  }

  let body: { content_id?: unknown; content_type?: unknown; prod_only?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const { content_id, content_type, prod_only } = body;
  const prodOnly = prod_only === true;
  if (typeof content_id !== "string" || content_id.length === 0) {
    return jsonResponse(req, { ok: false, message: "content_id is required" }, 400);
  }
  if (!isContentType(content_type)) {
    return jsonResponse(req, { ok: false, message: `Unknown content type: ${content_type}` }, 400);
  }

  const staging = createClient(stagingUrl, stagingKey);

  // When prod_only=true we only remove from production (demote), leaving the
  // staging copy intact so the author can re-promote later.
  if (!prodOnly) {
    const { error: stagingErr } = await staging
      .from("content_staging")
      .delete()
      .eq("content_id", content_id)
      .eq("content_type", content_type);
    if (stagingErr) {
      return jsonResponse(req, { ok: false, message: `Staging delete failed: ${stagingErr.message}` }, 500);
    }
  }

  const { error: prodErr } = await prod
    .from("content_published")
    .delete()
    .eq("content_id", content_id)
    .eq("content_type", content_type);
  if (prodErr) {
    return jsonResponse(req, { ok: false, message: `Production delete failed: ${prodErr.message}` }, 500);
  }

  // Removing a glossary term from production re-links published lessons so the
  // term stops appearing as a link in the live app.
  let relinkedStaging = 0;
  let relinkedPublished = 0;
  if (content_type === "glossary") {
    if (!prodOnly) relinkedStaging = await relinkLessons(staging, "content_staging");
    relinkedPublished = await relinkLessons(prod, "content_published");
  }

  return jsonResponse(req, {
    ok: true,
    content_id,
    content_type,
    prod_only: prodOnly,
    relinkedStaging,
    relinkedPublished,
  });
});
