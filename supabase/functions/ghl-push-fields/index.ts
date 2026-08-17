// Ghl-push-fields Edge Function (M3-13).
// A signed-in member pushes their progress to their own GoHighLevel contact's
// custom fields, via the Private Integration token (server-side). Called on the
// relevant events (finishing a training session). Scoped to the caller's own
// email from their JWT, so it can only write their own contact. Fail-open: any
// error returns a harmless noop rather than blocking the app.
//
// The five field keys are Steve's, used verbatim (do not rename):
//   contact.last_trained_date     (date)   - LIVE, from user_streaks / answer_events
//   contact.current_streak        (number) - LIVE, from user_streaks
//   contact.weakest_concept       (text)   - TODO: M4 diagnostics
//   contact.weekly_goal_progress  (text)   - TODO: M5 ("3 of 5")
//   contact.monthly_days_trained  (number) - TODO: M5
// Only fields that have a value are sent; the three TODO fields populate once
// their M4/M5 data sources exist.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { getContactByEmail, updateContactFields } from "../_shared/ghl.ts";
import type { ContactField } from "../_shared/ghl.ts";

type Client = ReturnType<typeof createClient>;

async function computeFields(prod: Client, userId: string): Promise<ContactField[]> {
  const fields: ContactField[] = [];

  const { data: streak } = await prod
    .from("user_streaks")
    .select("current_streak, last_active_date")
    .eq("user_id", userId)
    .maybeSingle();

  let lastTrained: string | null =
    (streak?.last_active_date as string | null | undefined) ?? null;
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
  if (streak) fields.push({ key: "contact.current_streak", value: Number(streak.current_streak) });

  // contact.weakest_concept (M4), contact.weekly_goal_progress (M5),
  // contact.monthly_days_trained (M5) are added here once those data sources land.
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
