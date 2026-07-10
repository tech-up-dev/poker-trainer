// Stripe customer portal session creator.
// Looks up the caller's stripe_customer_id from user_profiles and creates a
// Stripe billing portal session so the member can manage their subscription
// (cancel, upgrade, update payment method) without any custom billing UI.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - standard Supabase
//   STRIPE_SECRET_KEY - Stripe secret key (sk_live_... or sk_test_...)

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";

type StripeSession = { url: string };
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

  const { data: profile, error: profileErr } = await prod
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileErr) {
    return jsonResponse(req, { ok: false, message: profileErr.message }, 500);
  }

  if (!profile?.stripe_customer_id) {
    return jsonResponse(req, { ok: false, message: "No billing account found" }, 404);
  }

  let returnUrl: string;
  try {
    const body = await req.json() as { return_url?: string };
    returnUrl = typeof body.return_url === "string" && body.return_url.length > 0
      ? body.return_url
      : `${req.headers.get("Origin") ?? ""}/play/profile`;
  } catch {
    returnUrl = `${req.headers.get("Origin") ?? ""}/play/profile`;
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    }),
  });

  if (!stripeRes.ok) {
    const stripeErr = await stripeRes.json().catch(() => ({})) as StripeError;
    return jsonResponse(
      req,
      { ok: false, message: stripeErr.error?.message ?? "Stripe error" },
      502,
    );
  }

  const session = await stripeRes.json() as StripeSession;
  return jsonResponse(req, { ok: true, url: session.url });
});
