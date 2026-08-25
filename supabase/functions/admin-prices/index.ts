// Admin-prices Edge Function (Steve M3 follow-up item 1b).
// Admin-only CRUD over stripe_prices so Steve can edit the plan catalog without a
// code deploy. Actions:
//   - list:   returns all prices (enabled AND disabled), sorted
//   - upsert: create a new price or update an existing one (by price_id)
//   - enable: set enabled=<true|false> for a price_id (soft-delete; Stripe forbids
//             deleting a price that has ever been used, so we never delete)

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";

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
    if (err instanceof AdminError) return jsonResponse(req, { ok: false, message: err.message }, err.status);
    throw err;
  }

  let body: {
    action?: unknown;
    price_id?: unknown;
    label?: unknown;
    amount?: unknown;
    interval?: unknown;
    enabled?: unknown;
    sort_order?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "list") {
    const { data, error } = await admin
      .from("stripe_prices")
      .select("id, price_id, label, amount, interval, enabled, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true });
    if (error) return jsonResponse(req, { ok: false, message: error.message }, 500);
    return jsonResponse(req, { ok: true, prices: data ?? [] });
  }

  if (action === "upsert") {
    const priceId = typeof body.price_id === "string" ? body.price_id.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const amount = Number(body.amount);
    const interval = typeof body.interval === "string" ? body.interval : "";
    const enabled = body.enabled === false ? false : true;
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    if (!priceId || !label) {
      return jsonResponse(req, { ok: false, message: "price_id and label are required" }, 400);
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return jsonResponse(req, { ok: false, message: "amount must be a non-negative number" }, 400);
    }
    if (interval !== "month" && interval !== "year") {
      return jsonResponse(req, { ok: false, message: "interval must be 'month' or 'year'" }, 400);
    }
    const { data, error } = await admin
      .from("stripe_prices")
      .upsert(
        { price_id: priceId, label, amount, interval, enabled, sort_order: sortOrder, updated_at: new Date().toISOString() },
        { onConflict: "price_id" },
      )
      .select()
      .maybeSingle();
    if (error) return jsonResponse(req, { ok: false, message: error.message }, 500);
    return jsonResponse(req, { ok: true, price: data });
  }

  if (action === "enable") {
    const priceId = typeof body.price_id === "string" ? body.price_id.trim() : "";
    const enabled = Boolean(body.enabled);
    if (!priceId) return jsonResponse(req, { ok: false, message: "price_id is required" }, 400);
    const { error } = await admin
      .from("stripe_prices")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("price_id", priceId);
    if (error) return jsonResponse(req, { ok: false, message: error.message }, 500);
    return jsonResponse(req, { ok: true, price_id: priceId, enabled });
  }

  return jsonResponse(req, { ok: false, message: "Unknown action; must be 'list', 'upsert', or 'enable'" }, 400);
});
