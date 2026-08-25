// Admin-send-recovery Edge Function (M3 follow-up 5b).
// Admin-gated: lets a support/admin trigger the Supabase password-recovery email
// for any member (typical support case: "member forgot their password, help me
// send them a reset link"). Uses the Supabase Auth admin API to generate the
// recovery link and its email, which routes through our custom SMTP (Resend).
//
// The response returns { sent: true } on success plus a `properties` block
// (containing the raw action_link) that the admin FE can optionally show for an
// out-of-band share (Slack DM etc). No plaintext password ever crosses the wire.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { jsonResponse, preflight } from "../_shared/responses.ts";
import { assertAdmin, AdminError } from "../_shared/admin.ts";
import { findUserByEmail } from "../_shared/users.ts";

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

  let body: { email?: unknown; redirect_to?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, message: "Invalid JSON body" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return jsonResponse(req, { ok: false, message: "email is required" }, 400);

  const user = await findUserByEmail(admin, email);
  if (!user) return jsonResponse(req, { ok: false, message: "No user with that email" }, 404);

  // generateLink type=recovery both mints the link and (with SMTP configured)
  // sends the standard recovery email through our SMTP provider.
  const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : undefined;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (error) {
    return jsonResponse(req, { ok: false, message: `Supabase Auth error: ${error.message}` }, 500);
  }

  return jsonResponse(req, {
    ok: true,
    sent: true,
    user_id: user.id,
    email,
    // action_link is included so the admin FE can optionally show a copyable
    // fallback link (e.g. if the user says the email never arrives).
    action_link: data?.properties?.action_link ?? null,
  });
});
