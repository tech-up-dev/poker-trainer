// Ghl-webhook Edge Function (M3-14 #2).
// Target of a GoHighLevel Workflow "Webhook" action, fired when a contact's tags
// change. GHL has no Supabase JWT, so this is gated by a shared secret header
// (x-webhook-secret) instead of the admin JWT, and must be deployed with
// --no-verify-jwt. The payload only tells us WHICH contact changed; we re-fetch
// the contact from GHL for its authoritative current tags, map the email to a
// Supabase user, and reconcile. No matching user yet (bought before signup) is a
// harmless noop that the signup sync / resync will pick up later.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { getContactById, getContactByEmail } from "../_shared/ghl.ts";
import { reconcileEntitlement } from "../_shared/ghl-entitlements.ts";
import { findUserByEmail } from "../_shared/users.ts";

// Pull a contact id or email out of a loosely-shaped GHL webhook body. The exact
// fields depend on how the Workflow is configured, so accept the common spots.
function extractRef(body: Record<string, unknown>): { id?: string; email?: string } {
  const contact = (body.contact ?? {}) as Record<string, unknown>;
  const id = body.contact_id ?? body.contactId ?? body.id ?? contact.id;
  const email = body.email ?? contact.email;
  return {
    id: typeof id === "string" ? id : undefined,
    email: typeof email === "string" ? email : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("GHL_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return jsonResponse(req, { ok: false, message: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const prod = createClient(url, key);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const ref = extractRef(body);
  if (!ref.id && !ref.email) {
    return jsonResponse(req, { ok: true, action: "noop", reason: "no contact reference" });
  }

  try {
    const contact = ref.id ? await getContactById(ref.id) : await getContactByEmail(ref.email as string);
    if (!contact?.email) {
      return jsonResponse(req, { ok: true, action: "noop", reason: "contact not resolved" });
    }
    const user = await findUserByEmail(prod, contact.email);
    if (!user) {
      return jsonResponse(req, { ok: true, action: "noop", reason: "no matching user" });
    }
    const result = await reconcileEntitlement(prod, user.id, contact.tags, contact.id);
    return jsonResponse(req, { ok: true, ...result });
  } catch (_err) {
    // Fail-open: acknowledge with 200 so GHL does not spin on retries, but make no
    // entitlement change on a sync error. The resync is the safety net.
    return jsonResponse(req, { ok: true, action: "noop", reason: "sync unavailable" });
  }
});
