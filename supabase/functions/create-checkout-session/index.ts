// Stripe Checkout session creator.
// Two modes:
//   1. Authed (returning member reactivating a lapsed sub): sends the caller's
//      user email to Stripe and reuses their stored stripe_customer_id if any.
//   2. Anonymous (pay-first signup, Steve M3 follow-up item 1): the browser
//      passes `email` in the body and no Authorization header. Stripe collects
//      the email; the stripe-webhook then creates the auth user on
//      checkout.session.completed. No free/unpaid accounts.
//
// Double-purchase guard: whichever mode, if the email already has an active
// quiz_app_access entitlement we refuse with a 400 + { code: 'already_subscribed' }
// so the FE can show the "you're already subscribed" screen.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - standard Supabase
//   STRIPE_SECRET_KEY - Stripe secret key (sk_live_... or sk_test_...)

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { findUserByEmail } from "../_shared/users.ts";

type StripeCheckoutSession = { url: string; id: string };
type StripeError = { error?: { message?: string } };

type Client = ReturnType<typeof createClient>;

// True when the email already has an active quiz_app_access. Used for the
// double-purchase guard. Missing user is not active.
async function hasActiveAccess(admin: Client, email: string): Promise<boolean> {
  const user = await findUserByEmail(admin, email);
  if (!user) return false;
  const { data } = await admin
    .from("entitlements")
    .select("status")
    .eq("user_id", user.id)
    .eq("entitlement_key", "quiz_app_access")
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const prodUrl = Deno.env.get("SUPABASE_URL");
  const prodKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!prodUrl || !prodKey || !stripeKey) {
    return jsonResponse(req, { ok: false, message: "Missing environment variables" }, 500);
  }

  const prod = createClient(prodUrl, prodKey);

  let body: {
    price_id?: string;
    email?: string;
    success_url?: string;
    cancel_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid request body" }, 400);
  }
  if (!body.price_id) {
    return jsonResponse(req, { ok: false, message: "price_id is required" }, 400);
  }
  const priceId = body.price_id;
  const origin = req.headers.get("Origin") ?? "";
  const successUrl = body.success_url ?? `${origin}/play/checkout/success`;
  const cancelUrl = body.cancel_url ?? `${origin}/play/profile`;

  // Verify the price is in our catalog and enabled. This blocks arbitrary
  // Stripe price_ids from being used for checkout and keeps the admin-managed
  // enabled flag honest (a soft-deleted price cannot be re-checked out).
  const { data: priceRow } = await prod
    .from("stripe_prices")
    .select("price_id, enabled")
    .eq("price_id", priceId)
    .maybeSingle();
  if (!priceRow || !priceRow.enabled) {
    return jsonResponse(req, { ok: false, message: "Unknown or disabled price" }, 400);
  }

  // Resolve the buyer's identity in one of two modes:
  //   (a) Authed: caller passes a Bearer token; buyer is that member (reactivate
  //       or re-check-out for an authed user).
  //   (b) Anon:   no auth; caller passes `email` in the body; a brand-new buyer
  //       who does not have an account yet (item 1 pay-first flow).
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  let email = "";
  let userId: string | null = null;
  if (token) {
    const { data: { user }, error: authErr } = await prod.auth.getUser(token);
    if (authErr || !user) {
      return jsonResponse(req, { ok: false, message: "Invalid or expired token" }, 401);
    }
    email = user.email ?? "";
    userId = user.id;
  } else if (typeof body.email === "string" && body.email.trim()) {
    email = body.email.trim().toLowerCase();
  } else {
    return jsonResponse(
      req,
      { ok: false, message: "Missing Authorization header or email in body" },
      400,
    );
  }

  // Double-purchase guard: refuse if this email already has an active
  // quiz_app_access. Applies to BOTH modes - a signed-in member with a stale
  // checkout URL and a brand-new buyer whose email was granted through GHL both
  // hit the same wall, and the FE routes them to "you're already subscribed".
  if (await hasActiveAccess(prod, email)) {
    return jsonResponse(
      req,
      { ok: false, code: "already_subscribed", message: "This email already has an active subscription." },
      400,
    );
  }

  // Reuse the stored Stripe customer for an authed returning buyer so they aren't
  // re-asked for card details. Anon buyers have no stored customer yet; Stripe
  // creates one from `customer_email`.
  const params: Record<string, string> = {
    "mode": "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "success_url": `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    "cancel_url": cancelUrl,
    // Round-2 #7: require the ToS checkbox. Stripe reads the terms of service
    // URL from Settings -> Public details on the Stripe account, so the URL is
    // configured in the dashboard, not here.
    "consent_collection[terms_of_service]": "required",
    // #48 name capture: Stripe collects first/last name on the checkout page
    // and hands them back on checkout.session.completed under session.custom_fields.
    // No phone (Steve's decision).
    "custom_fields[0][key]": "first_name",
    "custom_fields[0][label][type]": "custom",
    "custom_fields[0][label][custom]": "First name",
    "custom_fields[0][type]": "text",
    "custom_fields[0][text][minimum_length]": "1",
    "custom_fields[0][text][maximum_length]": "50",
    "custom_fields[1][key]": "last_name",
    "custom_fields[1][label][type]": "custom",
    "custom_fields[1][label][custom]": "Last name",
    "custom_fields[1][type]": "text",
    "custom_fields[1][text][minimum_length]": "1",
    "custom_fields[1][text][maximum_length]": "50",
  };
  let existingCustomerId: string | null = null;
  if (userId) {
    const { data: profile } = await prod
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    existingCustomerId = profile?.stripe_customer_id ?? null;
  }
  if (existingCustomerId) {
    params["customer"] = existingCustomerId;
  } else {
    params["customer_email"] = email;
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  if (!stripeRes.ok) {
    const stripeErr = await stripeRes.json().catch(() => ({})) as StripeError;
    return jsonResponse(
      req,
      { ok: false, message: stripeErr.error?.message ?? "Stripe error" },
      502,
    );
  }

  const session = await stripeRes.json() as StripeCheckoutSession;
  return jsonResponse(req, { ok: true, url: session.url, session_id: session.id });
});
