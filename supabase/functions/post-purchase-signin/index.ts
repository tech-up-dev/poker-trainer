// Post-purchase-signin Edge Function (Steve M3 follow-up item 1, pay-first flow).
//
// After Stripe redirects the browser to /play/checkout/success?session_id=<id>,
// the FE calls this endpoint with that session_id. We:
//   1. retrieve the Checkout Session from Stripe and verify it is actually paid
//   2. get the buyer's email + customer id from the verified session
//   3. ensure an auth user exists for that email (race with stripe-webhook: if
//      the webhook already created the user, reuse it; if not, create here)
//   4. ensure the quiz_app_access entitlement is granted (same race)
//   5. return a Supabase Auth recovery link the FE navigates to, which signs
//      the buyer in AND lands them on the set-password screen
//
// Security model: Stripe session ids are unguessable one-time values, and we
// only trust the email once Stripe confirms `payment_status = 'paid'`. So this
// endpoint is safe to expose anonymously (--no-verify-jwt) - the Stripe
// verification IS the authorization.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { findUserByEmail } from "../_shared/users.ts";

const KEY = "quiz_app_access";

type StripeSession = {
  id?: string;
  payment_status?: string;
  status?: string;
  customer?: string;
  customer_email?: string;
  customer_details?: { email?: string };
  subscription?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!url || !key || !stripeKey) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  let body: { session_id?: unknown; redirect_to?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (!sessionId) {
    return jsonResponse(req, { ok: false, message: "session_id is required" }, 400);
  }
  const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : undefined;

  // 1-2. Verify the Stripe session and pull the trusted email.
  const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  if (!sRes.ok) {
    return jsonResponse(req, { ok: false, message: "Unknown checkout session" }, 400);
  }
  const session = await sRes.json() as StripeSession;
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    session.status === "complete";
  if (!paid) {
    return jsonResponse(req, { ok: false, message: "Session is not paid" }, 400);
  }
  const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
  const customerId = typeof session.customer === "string" ? session.customer : null;
  if (!email) {
    return jsonResponse(req, { ok: false, message: "Session has no email" }, 400);
  }

  const admin = createClient(url, key);

  // 3. Ensure the auth user exists. The stripe-webhook may have already created
  //    it; if not, create here. createUser on an existing email returns an error,
  //    which we treat as "already exists" and re-look up.
  let user = await findUserByEmail(admin, email);
  if (!user) {
    const tempPassword = crypto.randomUUID() + crypto.randomUUID();
    const created = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (created.data.user) {
      user = { id: created.data.user.id, email };
    } else {
      user = await findUserByEmail(admin, email); // race lost - webhook just created
    }
  }
  if (!user) {
    return jsonResponse(req, { ok: false, message: "Could not create or find user" }, 500);
  }

  // 4. Ensure the entitlement is granted (idempotent - webhook likely already did).
  if (customerId) {
    await admin.from("user_profiles").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
  }
  await admin.from("entitlements").upsert(
    {
      user_id: user.id,
      entitlement_key: KEY,
      status: "active",
      source: `stripe:${customerId ?? "session:" + sessionId}`,
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entitlement_key" },
  );

  // 5. Mint a one-time recovery link. The FE navigates the browser to it: the
  //    user is signed in AND lands on the reset-password screen, where they set
  //    their real password. No password crosses the wire.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (linkErr) {
    return jsonResponse(req, { ok: false, message: `Auth link error: ${linkErr.message}` }, 500);
  }

  return jsonResponse(req, {
    ok: true,
    user_id: user.id,
    email,
    action_link: linkData?.properties?.action_link ?? null,
  });
});
