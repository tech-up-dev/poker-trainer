// Admin-members Edge Function (M3 follow-up 5b).
// Admin-only member directory + support view: list all members with their
// quiz_app_access status, signup date, last auth sign-in, and last training day.
// Query params: ?q=<email substring, case-insensitive> and ?limit=<50 default,
// max 200>. Response is a flat list, no pagination cursor (small user base for
// launch; revisit if it grows past a few thousand).

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";

type Client = ReturnType<typeof createClient>;

type Row = {
  user_id: string;
  email: string | null;
  created_at: string | null;          // signup
  last_sign_in_at: string | null;     // last auth session
  last_active_date: string | null;    // last training day (user_streaks)
  access_status: string | null;       // quiz_app_access status ('active' | 'cancelled' | 'past_due' | null)
  access_source: string | null;
  access_expires_at: string | null;
  is_admin: boolean;
};

async function listAllUsers(admin: Client) {
  const all: Array<{ id: string; email: string | null; created_at: string | null; last_sign_in_at: string | null }> = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    for (const u of data.users) {
      all.push({
        id: u.id,
        email: u.email ?? null,
        created_at: (u.created_at as string | undefined) ?? null,
        last_sign_in_at: (u.last_sign_in_at as string | undefined) ?? null,
      });
    }
    if (data.users.length < 200) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "GET" && req.method !== "POST") {
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
    if (err instanceof AdminError) return jsonResponse(req, { ok: false, message: err.message }, err.status);
    throw err;
  }

  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? 50)));

  // Fetch every user, then filter + trim in memory. Fine at launch scale.
  const users = await listAllUsers(admin);
  const filtered = q
    ? users.filter((u) => (u.email ?? "").toLowerCase().includes(q))
    : users;
  const page = filtered
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);

  if (page.length === 0) {
    return jsonResponse(req, { ok: true, members: [], total_matched: 0, total_users: users.length });
  }

  const ids = page.map((u) => u.id);

  const [entRes, streakRes] = await Promise.all([
    admin
      .from("entitlements")
      .select("user_id, entitlement_key, status, source, expires_at")
      .in("user_id", ids),
    admin.from("user_streaks").select("user_id, last_active_date").in("user_id", ids),
  ]);

  const accessByUser = new Map<string, { status: string; source: string | null; expires_at: string | null }>();
  const adminSet = new Set<string>();
  for (const e of (entRes.data ?? []) as Array<{
    user_id: string; entitlement_key: string; status: string; source: string | null; expires_at: string | null;
  }>) {
    if (e.entitlement_key === "quiz_app_access") {
      accessByUser.set(e.user_id, { status: e.status, source: e.source, expires_at: e.expires_at });
    }
    if (e.entitlement_key === "admin_access" && e.status === "active") {
      adminSet.add(e.user_id);
    }
  }
  const streakByUser = new Map<string, string | null>();
  for (const s of (streakRes.data ?? []) as Array<{ user_id: string; last_active_date: string | null }>) {
    streakByUser.set(s.user_id, s.last_active_date);
  }

  const members: Row[] = page.map((u) => {
    const acc = accessByUser.get(u.id) ?? null;
    return {
      user_id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      last_active_date: streakByUser.get(u.id) ?? null,
      access_status: acc?.status ?? null,
      access_source: acc?.source ?? null,
      access_expires_at: acc?.expires_at ?? null,
      is_admin: adminSet.has(u.id),
    };
  });

  return jsonResponse(req, {
    ok: true,
    members,
    total_matched: filtered.length,
    total_users: users.length,
  });
});
