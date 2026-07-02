// Stripe Checkout session creator.
// Accepts a price_id and creates a hosted Stripe Checkout session so the
// member can subscribe without any custom payment UI in the app.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - standard Supabase
//   STRIPE_SECRET_KEY - Stripe secret key (sk_live_... or sk_test_...)

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";

type StripeCheckoutSession = { url: string; id: string };
type StripeError = { error?: { message?: string } };

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

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return jsonResponse(req, { ok: false, message: "Missing Authorization header" }, 401);
  }

  const prod = createClient(prodUrl, prodKey);

  const {
    data: { user },
    error: authErr,
  } = await prod.auth.getUser(token);

  if (authErr || !user) {
    return jsonResponse(req, { ok: false, message: "Invalid or expired token" }, 401);
  }

  let priceId: string;
  let successUrl: string;
  let cancelUrl: string;

  try {
    const body = await req.json() as {
      price_id?: string;
      success_url?: string;
      cancel_url?: string;
    };

    if (!body.price_id) {
      return jsonResponse(req, { ok: false, message: "price_id is required" }, 400);
    }

    priceId = body.price_id;
    const origin = req.headers.get("Origin") ?? "";
    successUrl = body.success_url ?? `${origin}/play/checkout/success`;
    cancelUrl = body.cancel_url ?? `${origin}/play/profile`;
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid request body" }, 400);
  }

  // Look up existing Stripe customer ID so returning subscribers aren't asked
  // to re-enter their card details.
  const { data: profile } = await prod
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const params: Record<string, string> = {
    "mode": "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "success_url": `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    "cancel_url": cancelUrl,
    "customer_email": profile?.stripe_customer_id ? "" : user.email ?? "",
  };

  // Pre-fill customer if we already have their Stripe ID.
  if (profile?.stripe_customer_id) {
    delete params["customer_email"];
    params["customer"] = profile.stripe_customer_id;
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
