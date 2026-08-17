// Ghl-resync Edge Function (M3-14 #3).
// Periodic safety net that reconciles every member against GoHighLevel, catching
// any tag change whose webhook was missed. Meant to be called by a scheduler
// (pg_cron) with the shared secret header, so it is gated by GHL_RESYNC_SECRET
// and must be deployed with --no-verify-jwt. Walks the Supabase users, looks each
// one up in GHL by email, and reconciles. Best-effort per user: one failure never
// aborts the sweep.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { getContactByEmail } from "../_shared/ghl.ts";
import { reconcileFromTags } from "../_shared/ghl-entitlements.ts";

type Client = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("GHL_RESYNC_SECRET");
  if (!secret || req.headers.get("x-resync-secret") !== secret) {
    return jsonResponse(req, { ok: false, message: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const prod: Client = createClient(url, key);

  let scanned = 0, granted = 0, cancelled = 0, errors = 0;

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await prod.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    for (const user of data.users) {
      if (!user.email) continue;
      scanned++;
      try {
        const contact = await getContactByEmail(user.email);
        if (!contact) continue;
        const result = await reconcileFromTags(prod, user.id, contact.tags, contact.id);
        if (result.action === "granted") granted++;
        else if (result.action === "cancelled") cancelled++;
      } catch (_err) {
        errors++;
      }
    }
    if (data.users.length < 200) break;
  }

  return jsonResponse(req, { ok: true, scanned, granted, cancelled, errors });
});
