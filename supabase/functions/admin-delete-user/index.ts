// Admin-delete-user Edge Function (#80).
// Admin-only: permanently deletes a member's account. Deleting the auth user
// cascades to every per-user table (profile, entitlements, answers, progress,
// streaks, badges, saved items, GHL tags, points, session logs), so nothing is
// left behind.
//
// Body: { "user_id": "<uuid>", "cancel_subscription"?: true }
//
// Guards:
//   - Refused while the admin gate (REQUIRE_ADMIN) is off, because a delete
//     endpoint must never run unauthenticated.
//   - An admin can't delete themselves or another admin (remove admin access
//     first), so the CMS can't be locked out by accident.
//   - A member with an active Stripe subscription is refused with
//     code 'active_subscription' unless cancel_subscription is true; then the
//     subscription is cancelled in Stripe first, so nobody keeps getting billed
//     for an account that no longer exists.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (Deno.env.get("REQUIRE_ADMIN") !== "true") {
    return jsonResponse(req, { ok: false, message: "Admin gate is disabled; refusing to delete" }, 503);
  }

  const admin = createClient(url, key);

  try {
    await assertAdmin(req, admin);
  } catch (err) {
    if (err instanceof AdminError) return jsonResponse(req, { ok: false, message: err.message }, err.status);
    throw err;
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user: caller } } = await admin.auth.getUser(token);

  let body: { user_id?: unknown; cancel_subscription?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }
  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!UUID.test(userId)) return jsonResponse(req, { ok: false, message: "user_id must be a uuid" }, 400);
  if (userId === caller?.id) {
    return jsonResponse(req, { ok: false, code: "self", message: "You can't delete your own account" }, 400);
  }

  const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !target?.user) return jsonResponse(req, { ok: false, message: "No user with that id" }, 404);
  const email = target.user.email ?? null;

  const { data: ents } = await admin
    .from("entitlements")
    .select("entitlement_key, status, stripe_subscription_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if ((ents ?? []).some((e) => e.entitlement_key === "admin_access")) {
    return jsonResponse(req, {
      ok: false,
      code: "is_admin",
      message: "This user is an admin. Remove their admin access first.",
    }, 409);
  }

  const subId = (ents ?? []).find((e) => e.entitlement_key === "quiz_app_access")?.stripe_subscription_id ?? null;
  if (subId) {
    if (body.cancel_subscription !== true) {
      return jsonResponse(req, {
        ok: false,
        code: "active_subscription",
        message: "This member has an active Stripe subscription. Confirm cancelling it to delete the account.",
      }, 409);
    }
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return jsonResponse(req, { ok: false, message: "Missing STRIPE_SECRET_KEY" }, 500);
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    // 404 = already gone in Stripe, which is fine.
    if (!res.ok && res.status !== 404) {
      const detail = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      return jsonResponse(req, {
        ok: false,
        message: `Stripe refused to cancel the subscription: ${detail?.error?.message ?? res.status}`,
      }, 502);
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return jsonResponse(req, { ok: false, message: `Delete failed: ${delErr.message}` }, 500);

  return jsonResponse(req, {
    ok: true,
    deleted: { user_id: userId, email },
    subscription_cancelled: Boolean(subId),
  });
});
