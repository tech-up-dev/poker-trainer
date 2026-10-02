// Ghl-push-fields Edge Function.
// A signed-in member pushes their progress to their own GoHighLevel contact's
// custom fields, via the Private Integration token (server-side). Called on the
// relevant events (finishing a training session, completing a lesson, logging a
// live session). Scoped to the caller's own email from their JWT, so it can
// only write their own contact. Fail-open: any error returns a harmless noop
// rather than blocking the app.
//
// v5 scope (Issue #68 §7.5). Six fields now; two retired.
//
// Pushed:
//   contact.last_trained_date      date   - user_streaks.last_active_date (or newest answer_events)
//   contact.weakest_concept        text   - concepts.name of the lowest-accuracy summary row that cleared leak_min_attempts
//   contact.monthly_days_trained   number - distinct completion days this calendar month (lesson_complete + drill_complete rows)
//   contact.concepts_solid_count   number - count of concept_accuracy_summary rows where attempts >= threshold AND accuracy >= 0.75
//   contact.lesson_in_progress     text   - title of the most-recent incomplete user_progress lesson, or '' when none (clears stale value, §7.5 clarification)
//   contact.live_sessions_logged   number - count of session_logs rows for the member
//
// Retired (not pushed):
//   current_streak, weekly_goal_progress - §7.1 / §7.2 (streaks + weekly goal cut)
//
// Pre-flight: the three new fields (concepts_solid_count, lesson_in_progress,
// live_sessions_logged) need GHL field IDs from Steve. Until those IDs land in
// _shared/ghl.ts CUSTOM_FIELD_IDS, updateContactFields silently drops the three
// (filtered by falsy id). Replace the empty-string placeholders in that file
// as soon as Steve forwards the IDs; no change to this file is needed.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { getContactByEmail, updateContactFields } from "../_shared/ghl.ts";
import type { ContactField } from "../_shared/ghl.ts";

type Client = ReturnType<typeof createClient>;

// Admin-configurable floor for scoring a concept (also used by get_leaks and
// get_all_concept_scores). Default 8. Read inline so an admin change propagates
// without a redeploy.
async function minAttempts(prod: Client): Promise<number> {
  const { data } = await prod
    .from("app_settings")
    .select("value")
    .eq("key", "leak_min_attempts")
    .maybeSingle();
  const raw = (data?.value as unknown) ?? 8;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

async function computeFields(prod: Client, userId: string): Promise<ContactField[]> {
  const fields: ContactField[] = [];

  // last_trained_date - prefer the streak's last_active_date, fall back to the
  // newest answer_events row (date-only slice).
  const { data: streak } = await prod
    .from("user_streaks")
    .select("last_active_date")
    .eq("user_id", userId)
    .maybeSingle();

  let lastTrained: string | null = (streak?.last_active_date as string | null | undefined) ?? null;
  if (!lastTrained) {
    const { data: last } = await prod
      .from("answer_events")
      .select("answered_at")
      .eq("user_id", userId)
      .order("answered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const answeredAt = last?.answered_at as string | undefined;
    lastTrained = answeredAt ? answeredAt.slice(0, 10) : null;
  }
  if (lastTrained) fields.push({ key: "contact.last_trained_date", value: lastTrained });

  // concept_accuracy_summary driven fields: fetch once, derive both weakest and
  // concepts_solid_count from the same snapshot.
  const threshold = await minAttempts(prod);
  const { data: cas } = await prod
    .from("concept_accuracy_summary")
    .select("concept, attempts, accuracy")
    .eq("user_id", userId);

  const summary = (cas ?? []) as Array<{ concept: string; attempts: number; accuracy: number }>;
  const scored = summary.filter((r) => (r.attempts ?? 0) >= threshold);

  // weakest_concept: lowest accuracy among scored, ties broken by most attempts.
  // Push the human-readable name (joined from concepts) so GHL merge-tags render
  // the display label, not a slug.
  if (scored.length > 0) {
    const worst = [...scored].sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return (b.attempts ?? 0) - (a.attempts ?? 0);
    })[0];
    const { data: concept } = await prod
      .from("concepts")
      .select("name")
      .eq("slug", worst.concept)
      .maybeSingle();
    const label = (concept?.name as string | undefined) ?? worst.concept;
    fields.push({ key: "contact.weakest_concept", value: label });
  }

  // concepts_solid_count: how many of the scored concepts cleared 75%.
  const solidCount = scored.filter((r) => (r.accuracy ?? 0) >= 0.75).length;
  fields.push({ key: "contact.concepts_solid_count", value: solidCount });

  // monthly_days_trained: distinct dates (user TZ not tracked here; use UTC
  // as the push-monthly-qualification cron does, keeps the two in sync).
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data: ledger } = await prod
    .from("points_ledger")
    .select("created_at")
    .eq("user_id", userId)
    .in("reason", ["lesson_complete", "drill_complete"])
    .gte("created_at", monthStart);
  const days = new Set<string>();
  for (const row of (ledger ?? []) as Array<{ created_at: string }>) {
    days.add(row.created_at.slice(0, 10));
  }
  fields.push({ key: "contact.monthly_days_trained", value: days.size });

  // lesson_in_progress: most recent user_progress row where completed=false,
  // joined to the published lesson's title. Push an EXPLICIT empty string when
  // the member has none, so GHL clears a stale value and Steve's resume-your-
  // lesson automation does not fire on a lesson the member already finished
  // (confirmed with Blagojche 2026-10-01).
  const { data: inProgress } = await prod
    .from("user_progress")
    .select("content_id, content_type, last_attempted_at")
    .eq("user_id", userId)
    .eq("content_type", "lesson")
    .eq("completed", false)
    .order("last_attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lessonTitle = "";
  if (inProgress?.content_id) {
    const { data: published } = await prod
      .from("content_published")
      .select("content")
      .eq("content_id", inProgress.content_id)
      .eq("content_type", "lesson")
      .maybeSingle();
    const content = published?.content as Record<string, unknown> | undefined;
    const title = (content?.title as string | undefined) ?? "";
    lessonTitle = title;
  }
  fields.push({ key: "contact.lesson_in_progress", value: lessonTitle });

  // live_sessions_logged: raw count of the member's self-logged live-poker
  // sessions. Push 0 when none so GHL does not display a stale number.
  const { count: sessionCount } = await prod
    .from("session_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  fields.push({ key: "contact.live_sessions_logged", value: sessionCount ?? 0 });

  return fields;
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

  const prod = createClient(url, key);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await prod.auth.getUser(token);
  if (error || !user?.email) {
    return jsonResponse(req, { ok: false, message: "Invalid or expired token" }, 401);
  }

  try {
    const fields = await computeFields(prod, user.id);
    if (fields.length === 0) {
      return jsonResponse(req, { ok: true, action: "noop", reason: "no progress data yet" });
    }

    const contact = await getContactByEmail(user.email);
    if (!contact) {
      // Return what would be pushed so the caller can confirm the computation.
      return jsonResponse(req, { ok: true, action: "noop", reason: "no GHL contact", computed: fields });
    }

    const written = await updateContactFields(contact.id, fields);
    return jsonResponse(req, { ok: true, action: written ? "pushed" : "push_failed", fields });
  } catch (_err) {
    return jsonResponse(req, { ok: true, action: "noop", reason: "sync unavailable" });
  }
});
