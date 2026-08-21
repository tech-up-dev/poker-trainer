// Push-monthly-qualification Edge Function (M5-02).
// Daily-cron target. Counts each member's distinct qualifying days this calendar
// month (a qualifying day = one completed lesson or drill, i.e. a points_ledger
// lesson_complete / drill_complete row) and, when a member first crosses the
// admin-set monthly_goal_days threshold, tags their GHL contact
// monthly_qualified_{YYYY_MM}. Fires exactly once per member per month, tracked in
// monthly_qualifications. Gated by MONTHLY_QUAL_SECRET; deploy with --no-verify-jwt.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { upsertContact, addContactTag } from "../_shared/ghl.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("MONTHLY_QUAL_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return jsonResponse(req, { ok: false, message: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const db = createClient(url, key);

  // Admin-configurable threshold (default 20).
  const { data: setting } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "monthly_goal_days")
    .maybeSingle();
  const threshold = Number(setting?.value ?? 20);

  // Current calendar month window (UTC).
  const now = new Date();
  const period = `${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  // Completions this month (a qualifying day = a lesson/drill completion).
  const { data: rows } = await db
    .from("points_ledger")
    .select("user_id, created_at")
    .in("reason", ["lesson_complete", "drill_complete"])
    .gte("created_at", monthStart);

  // Distinct qualifying days per user.
  const daysByUser = new Map<string, Set<string>>();
  for (const r of (rows ?? []) as { user_id: string; created_at: string }[]) {
    const day = r.created_at.slice(0, 10);
    (daysByUser.get(r.user_id) ?? daysByUser.set(r.user_id, new Set()).get(r.user_id)!).add(day);
  }

  // Skip anyone already tagged this month.
  const { data: already } = await db
    .from("monthly_qualifications")
    .select("user_id")
    .eq("period", period);
  const done = new Set((already ?? []).map((r) => (r as { user_id: string }).user_id));

  let tagged = 0;
  for (const [userId, days] of daysByUser) {
    if (days.size < threshold || done.has(userId)) continue;

    // Claim the (user, month) first so the tag fires exactly once, even across
    // overlapping runs; a duplicate insert (already claimed) skips this user.
    const { error: insErr } = await db.from("monthly_qualifications").insert({ user_id: userId, period });
    if (insErr) continue;

    const { data: u } = await db.auth.admin.getUserById(userId);
    const email = u.user?.email;
    if (!email) continue;
    try {
      const contactId = await upsertContact(email);
      if (contactId) await addContactTag(contactId, `monthly_qualified_${period}`);
      tagged++;
    } catch {
      // Best-effort: the claim row stays, so a transient GHL error is not retried
      // (acceptable for the qualification hand-off; the resync/next month recovers).
    }
  }

  return jsonResponse(req, { ok: true, period, threshold, users_checked: daysByUser.size, tagged });
});
