// Ghl-sync-me Edge Function (M3-14 #1).
// A signed-in user reconciles their OWN quiz_app_access from GoHighLevel: look up
// their GHL contact by their account email, read its tags, grant/cancel. Called
// right after signup so a member who bought via GHL gets access without waiting
// for the periodic resync. Scoped to the caller's own email (derived from their
// JWT), so it can never grant access to anyone else. Fail-open: any error returns
// a harmless noop rather than blocking the signup flow.
//
// #74: also records the contact's current tags into member_ghl_tags, so Pro
// Training suppression sees a purchase tag that was added in GHL without
// waiting for the 06:00 UTC ghl-resync sweep (the ghl-webhook only fires on
// the access-tag workflow, not on purchase tags). Body `{ "tags_only": true }`
// refreshes tags WITHOUT touching the entitlement, for the Courses page to
// call on mount.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { getContactByEmail } from "../_shared/ghl.ts";
import { reconcileFromTags, recordMemberTags } from "../_shared/ghl-entitlements.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const prod = createClient(url, key);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await prod.auth.getUser(token);
  if (error || !user?.email) {
    return jsonResponse(req, { ok: false, message: "Invalid or expired token" }, 401);
  }

  const body = await req.json().catch(() => ({})) as { tags_only?: unknown };
  const tagsOnly = body.tags_only === true;

  try {
    const contact = await getContactByEmail(user.email);
    if (!contact) return jsonResponse(req, { ok: true, action: "noop", reason: "no GHL contact" });
    await recordMemberTags(prod, user.id, contact.tags);
    if (tagsOnly) return jsonResponse(req, { ok: true, action: "tags_refreshed" });
    const result = await reconcileFromTags(prod, user.id, contact.tags, contact.id);
    return jsonResponse(req, { ok: true, ...result });
  } catch (_err) {
    // Fail-open: never block or change access on a sync error.
    return jsonResponse(req, { ok: true, action: "noop", reason: "sync unavailable" });
  }
});
