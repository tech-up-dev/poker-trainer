// Save-to-staging Edge Function.
// Hosted on the production Supabase project. Validates the caller is an admin
// (production auth), then writes/upserts the content row to the staging DB
// using the staging service-role key. The frontend never touches the staging
// DB directly — all staging writes go through here.
//
// Content id resolution lives here because it needs to read staging to guarantee
// uniqueness:
//   - explicit id provided  -> use it (author is knowingly updating that row)
//   - id omitted            -> slug the label field, then find a free id:
//       same data under that slug -> reuse it (idempotent re-import)
//       different data           -> suffix -2, -3, … to keep both

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import {
  contentRegistry,
  isContentType,
  type ContentType,
} from "../../../shared/schemas/content.ts";
import { slugify, stableStringify } from "../../../shared/utils/slug.ts";

type StagingRow = { content_id: string; content: unknown };

// deno-lint-ignore no-explicit-any
async function resolveContentId(
  staging: any,
  contentType: ContentType,
  contentObj: Record<string, unknown>,
): Promise<string> {
  const def = contentRegistry[contentType];

  // Base slug from the type's label field; fall back to the type name so we
  // always have something (tips with no concept end up "tip", "tip-2", …).
  const label = def.labelField ? contentObj[def.labelField] : undefined;
  const base = (typeof label === "string" ? slugify(label) : "") || contentType;

  // Pull every existing row whose id starts with the base so we can compare data
  // and find the first free slot without a query per candidate.
  const { data } = await staging
    .from("content_staging")
    .select("content_id, content")
    .eq("content_type", contentType)
    .like("content_id", `${base}%`);

  const existing = new Map<string, unknown>(
    ((data ?? []) as StagingRow[]).map((r) => [r.content_id, r.content]),
  );
  const newCanonical = stableStringify(contentObj, def.idField);

  // free -> use it; same data -> reuse (overwrite is a no-op); different -> next.
  const fits = (id: string): boolean => {
    if (!existing.has(id)) return true;
    return stableStringify(existing.get(id), def.idField) === newCanonical;
  };

  if (fits(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (fits(candidate)) return candidate;
  }
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
  if (!isContentType(content_type)) {
    return jsonResponse(req, { ok: false, message: `Unknown content type: ${content_type}` }, 400);
  }
  if (content === null || typeof content !== "object" || Array.isArray(content)) {
    return jsonResponse(req, { ok: false, message: "content must be an object" }, 400);
  }

  const contentObj = { ...(content as Record<string, unknown>) };
  const def = contentRegistry[content_type];

  // An explicit id can arrive either as content_id or inside the content body.
  const bodyIdField = contentObj[def.idField];
  const explicit =
    (typeof content_id === "string" && content_id.length > 0 && content_id) ||
    (typeof bodyIdField === "string" && bodyIdField.length > 0 && bodyIdField) ||
    null;

  const staging = createClient(stagingUrl, stagingKey);

  const finalId = explicit ?? (await resolveContentId(staging, content_type, contentObj));

  // Keep the stored content self-consistent: its id field always matches the row.
  contentObj[def.idField] = finalId;

  const { error } = await staging.from("content_staging").upsert({
    content_id: finalId,
    content_type,
    content: contentObj,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return jsonResponse(req, { ok: false, message: error.message }, 500);
  }

  return jsonResponse(req, { ok: true, content_id: finalId, content_type });
});
