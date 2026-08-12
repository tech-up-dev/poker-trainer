// Admin-entitlements Edge Function (M3-14 #4 / #5).
// Hosted on the production Supabase project. Lets a signed-in admin search a
// member by email and grant or revoke an entitlement in seconds. Entitlements
// are service-role-only (RLS blocks client writes) and member lookup needs
// auth.users, so both have to happen here rather than from the browser.
//
// Writes carry a `source` of "manual:<admin email>" so a hand-grant is always
// distinguishable from a Stripe/GHL-driven one (add-only, per #5). Revoke is a
// soft cancel (status = 'cancelled'), which drops access while keeping the row
// and its source for the audit trail.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";

type Client = ReturnType<typeof createClient>;

// The entitlement keys an admin may hand-manage. Kept explicit so a typo can't
// mint an arbitrary key that nothing reads.
const KNOWN_KEYS = ["quiz_app_access", "admin_access"];

// Exact (case-insensitive) email lookup over auth.users. listUsers is paginated,
// so scan pages until a match or the last page. Fine for the current user base;
// revisit with a server-side filter if it ever grows large.
async function findUserByEmail(admin: Client, email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function listEntitlements(admin: Client, userId: string) {
  const { data } = await admin
    .from("entitlements")
    .select("entitlement_key, status, source, granted_at, expires_at")
    .eq("user_id", userId);
  return data ?? [];
}

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

  const admin = createClient(url, key);

  try {
    await assertAdmin(req, admin);
  } catch (err) {
    if (err instanceof AdminError) {
      return jsonResponse(req, { ok: false, message: err.message }, err.status);
    }
    throw err;
  }

  // Identify the acting admin so the write can be attributed in `source`.
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user: actor } } = await admin.auth.getUser(token);

  let body: {
    action?: unknown;
    email?: unknown;
    user_id?: unknown;
    entitlement_key?: unknown;
    expires_at?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const action = body.action;

  if (action === "search") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) return jsonResponse(req, { ok: false, message: "email is required" }, 400);
    const user = await findUserByEmail(admin, email);
    if (!user) return jsonResponse(req, { ok: true, user: null, entitlements: [] });
    return jsonResponse(req, {
      ok: true,
      user: { id: user.id, email: user.email },
      entitlements: await listEntitlements(admin, user.id),
    });
  }

  if (action === "grant" || action === "revoke") {
    const userId = String(body.user_id ?? "");
    const entitlementKey = String(body.entitlement_key ?? "quiz_app_access");
    if (!userId) return jsonResponse(req, { ok: false, message: "user_id is required" }, 400);
    if (!KNOWN_KEYS.includes(entitlementKey)) {
      return jsonResponse(req, { ok: false, message: `Unknown entitlement_key: ${entitlementKey}` }, 400);
    }

    const source = `manual:${actor?.email ?? "admin"}`;
    const now = new Date().toISOString();

    if (action === "grant") {
      const expiresAt = typeof body.expires_at === "string" && body.expires_at.length > 0
        ? body.expires_at
        : null;
      const { error } = await admin.from("entitlements").upsert(
        {
          user_id: userId,
          entitlement_key: entitlementKey,
          status: "active",
          source,
          expires_at: expiresAt,
          updated_at: now,
        },
        { onConflict: "user_id,entitlement_key" },
      );
      if (error) return jsonResponse(req, { ok: false, message: error.message }, 500);
    } else {
      const { error } = await admin
        .from("entitlements")
        .update({ status: "cancelled", source, updated_at: now })
        .eq("user_id", userId)
        .eq("entitlement_key", entitlementKey);
      if (error) return jsonResponse(req, { ok: false, message: error.message }, 500);
    }

    return jsonResponse(req, { ok: true, entitlements: await listEntitlements(admin, userId) });
  }

  return jsonResponse(req, { ok: false, message: `Unknown action: ${action}` }, 400);
});
