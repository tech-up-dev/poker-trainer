// Stripe-webhook Edge Function (M3-05 / M3-07, the in-app purchase path).
// Receives Stripe subscription lifecycle events and reconciles the member's
// quiz_app_access entitlement. Stripe sends no Supabase JWT, so this is gated by
// Stripe's own signature (the Stripe-Signature header verified against
// STRIPE_WEBHOOK_SECRET) and MUST be deployed with --no-verify-jwt.
//
// Rules (per the client's setup):
//   - Single access level. Every price on the one product grants the same
//     quiz_app_access; nothing is gated on which price was paid. The price id is
//     recorded for reference only.
//   - Trialing counts as access. A subscription that is `trialing` or `active`
//     grants, written as entitlement status 'active' (what the app gate reads and
//     the only non-cancelled grant the schema allows; a promo sitting in Stripe
//     `trialing` must not be denied).
//   - A definitively ended subscription (canceled / unpaid / incomplete_expired /
//     deleted) cancels. Transient states such as past_due are left untouched, so a
//     temporary payment retry never revokes a member mid-dunning.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY
// (used only to resolve a customer's email when we have not linked them yet),
// STRIPE_WEBHOOK_SECRET (signature verification).

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse } from "../_shared/responses.ts";
import { findUserByEmail } from "../_shared/users.ts";
import { upsertContact, addContactTag, removeContactTag } from "../_shared/ghl.ts";

type Client = ReturnType<typeof createClient>;

const KEY = "quiz_app_access";
const GRANT_STATUSES = new Set(["trialing", "active"]);
const CANCEL_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

// Constant-time compare of two equal-length hex strings.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verify a Stripe webhook signature. Header scheme: t=<ts>,v1=<sig>[,v1=<sig>...].
// Signed payload is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret.
async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!sigHeader) return false;
  let timestamp = "";
  const v1s: string[] = [];
  for (const part of sigHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") v1s.push(v);
  }
  if (!timestamp || v1s.length === 0) return false;

  // Replay protection: reject stale timestamps.
  const ts = Number(timestamp);
  if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1s.some((v1) => timingSafeEqualHex(expected, v1));
}

// Map a Stripe customer id to our user id: first via the stored
// user_profiles.stripe_customer_id, otherwise by looking the customer's email up
// in Stripe and matching an existing auth user (then backfilling the link so the
// next event resolves without an API call).
async function resolveUserId(prod: Client, stripeKey: string, customerId: string): Promise<string | null> {
  const { data: profile } = await prod
    .from("user_profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (profile?.user_id) return profile.user_id as string;

  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  if (!res.ok) return null;
  const customer = await res.json() as { email?: string };
  if (!customer.email) return null;
  const user = await findUserByEmail(prod, customer.email);
  if (!user) return null;
  await prod.from("user_profiles").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
  return user.id;
}

type StripeSubscription = {
  id: string;
  status: string;
  customer: string | { id: string };
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

function customerIdOf(sub: StripeSubscription): string | null {
  return typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
}

async function grant(prod: Client, userId: string, sub: StripeSubscription, customerId: string): Promise<void> {
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const expiresAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  await prod.from("entitlements").upsert(
    {
      user_id: userId,
      entitlement_key: KEY,
      status: "active",
      source: `stripe:${customerId}`,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entitlement_key" },
  );
}

async function cancel(prod: Client, userId: string, sub: StripeSubscription, customerId: string): Promise<void> {
  await prod
    .from("entitlements")
    .update({
      status: "cancelled",
      source: `stripe:${customerId}`,
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("entitlement_key", KEY);
}

const SUBSCRIBER_TAG = (): string => Deno.env.get("GHL_SUBSCRIBER_TAG") ?? "app_subscriber_active";

// Land the in-app buyer in GHL and (un)apply the subscriber tag so the client's
// CRM and email workflows fire (M3-06). Best-effort: it never breaks the
// entitlement path. Applying the tag also fires the client's tag workflow ->
// our ghl-webhook, which idempotently re-grants; that is harmless.
async function syncGhlTag(email: string, add: boolean): Promise<void> {
  try {
    const contactId = await upsertContact(email);
    if (!contactId) return;
    if (add) await addContactTag(contactId, SUBSCRIBER_TAG());
    else await removeContactTag(contactId, SUBSCRIBER_TAG());
  } catch (_err) {
    // CRM sync is best-effort.
  }
}

async function userEmail(prod: Client, userId: string): Promise<string | null> {
  const { data } = await prod.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!url || !key || !stripeKey || !webhookSecret) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  // Raw body is required for signature verification (must be the exact bytes).
  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get("Stripe-Signature"), webhookSecret))) {
    return jsonResponse(req, { ok: false, message: "Invalid signature" }, 400);
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON" }, 400);
  }

  const prod = createClient(url, key);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Grant straight from the session: the buyer email and customer id are in
        // the event, so a completed in-app subscription unlocks access immediately
        // without a later subscription.* event and without the Stripe key needing
        // to read customers (the prod key is a restricted key). Also stores the
        // customer -> user link so subsequent subscription.* events resolve locally.
        const session = event.data.object as {
          customer?: string;
          customer_email?: string;
          customer_details?: { email?: string };
          subscription?: string;
        };
        const email = session.customer_details?.email ?? session.customer_email ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        if (email && customerId) {
          // Pay-first (Steve M3 follow-up item 1): if no auth user exists for
          // this email yet, create one now with a random password. The buyer
          // arrives at /play/checkout/success, is signed in via a one-time
          // recovery link (post-purchase-signin), and sets their real password.
          // email_confirm=true so recovery works immediately with no verify.
          let user = await findUserByEmail(prod, email);
          if (!user) {
            const tempPassword = crypto.randomUUID() + crypto.randomUUID();
            const created = await prod.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
            });
            if (created.data.user) {
              user = { id: created.data.user.id, email };
            }
          }
          if (user) {
            await prod.from("user_profiles").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
            await prod.from("entitlements").upsert(
              {
                user_id: user.id,
                entitlement_key: KEY,
                status: "active",
                source: `stripe:${customerId}`,
                stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,entitlement_key" },
            );
            await syncGhlTag(email, true);
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as unknown as StripeSubscription;
        const customerId = customerIdOf(sub);
        if (!customerId) break;
        const userId = await resolveUserId(prod, stripeKey, customerId);
        if (!userId) break; // bought before signup / no match: the GHL path or resync covers it
        if (GRANT_STATUSES.has(sub.status)) await grant(prod, userId, sub, customerId);
        else if (CANCEL_STATUSES.has(sub.status)) {
          await cancel(prod, userId, sub, customerId);
          const email = await userEmail(prod, userId);
          if (email) await syncGhlTag(email, false);
        }
        // other statuses (e.g. past_due) are intentionally left as-is
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        const customerId = customerIdOf(sub);
        if (!customerId) break;
        const userId = await resolveUserId(prod, stripeKey, customerId);
        if (userId) {
          await cancel(prod, userId, sub, customerId);
          const email = await userEmail(prod, userId);
          if (email) await syncGhlTag(email, false);
        }
        break;
      }
      default:
        break; // unhandled event types are acknowledged with 200
    }
  } catch (_err) {
    // Signal a retry to Stripe on a transient processing failure.
    return jsonResponse(req, { ok: false, message: "Processing error" }, 500);
  }

  return jsonResponse(req, { ok: true, received: true });
});
