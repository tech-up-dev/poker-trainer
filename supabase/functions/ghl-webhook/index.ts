// Ghl-webhook Edge Function (M3-14).
// Target of the two GoHighLevel Workflows (one on the access tag being added, one
// on it being removed). GHL has no Supabase JWT, so this is gated by a shared
// secret header (x-webhook-secret) and must be deployed with --no-verify-jwt.
//
// The payload carries the contact id, email, the tag, and whether it was added or
// removed. We re-fetch the contact from GHL with the Private Integration token for
// its authoritative current tags and reconcile from those (access tag present ->
// grant, absent -> cancel); if that read is unavailable we fall back to the
// add/remove signal in the payload. Writes are add-only with a source, and the
// whole thing fails open: any error acknowledges with 200 and changes nothing, so
// a GHL retry storm or a transient outage never revokes a paying member.
//
// The exact payload field names are finalized on the setup call; extraction below
// is deliberately lenient across the common shapes.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { getContactById, getContactByEmail } from "../_shared/ghl.ts";
import { reconcileFromTags, reconcileFromAction } from "../_shared/ghl-entitlements.ts";
import { findUserByEmail } from "../_shared/users.ts";

function extractRef(body: Record<string, unknown>): {
  id?: string;
  email?: string;
  tag?: string;
  add: boolean | null;
} {
  const contact = (body.contact ?? {}) as Record<string, unknown>;
  const id = body.contact_id ?? body.contactId ?? body.id ?? contact.id;
  const email = body.email ?? contact.email;
  const tag = body.tag ?? body.tag_name ?? body.tagName;
  const action = String(body.action ?? body.type ?? body.event ?? body.status ?? "").toLowerCase();
  let add: boolean | null = null;
  if (/add|subscrib|activ|grant/.test(action)) add = true;
  else if (/remov|delet|cancel|lapse|inactiv|revoke/.test(action)) add = false;
  return {
    id: typeof id === "string" ? id : undefined,
    email: typeof email === "string" ? email : undefined,
    tag: typeof tag === "string" ? tag : undefined,
    add,
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
    // Authoritative current state from GHL.
    let contact = null;
    try {
      contact = ref.id ? await getContactById(ref.id) : await getContactByEmail(ref.email as string);
    } catch {
      contact = null;
    }

    const email = contact?.email ?? ref.email;
    if (!email) {
      return jsonResponse(req, { ok: true, action: "noop", reason: "no email to match" });
    }
    const user = await findUserByEmail(prod, email);
    if (!user) {
      // Bought before signing up: signup sync / resync will pick them up later.
      return jsonResponse(req, { ok: true, action: "noop", reason: "no matching user" });
    }
    const contactId = contact?.id ?? ref.id ?? "unknown";

    let result;
    if (contact) {
      result = await reconcileFromTags(prod, user.id, contact.tags, contactId);
    } else if (ref.add !== null) {
      result = await reconcileFromAction(prod, user.id, ref.add, contactId);
    } else {
      return jsonResponse(req, { ok: true, action: "noop", reason: "state undetermined" });
    }
    return jsonResponse(req, { ok: true, ...result });
  } catch (_err) {
    // Fail-open: acknowledge with 200 and change nothing.
    return jsonResponse(req, { ok: true, action: "noop", reason: "sync unavailable" });
  }
});
