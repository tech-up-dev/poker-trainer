// Admin-send-recovery Edge Function (M3 follow-up 5b).
// Admin-gated: lets a support/admin trigger a real password-recovery email for a
// member (typical support case: "member forgot their password, help me send them
// a reset link"). It only dispatches the standard recovery email through our
// configured SMTP (Resend).
//
// #76 (2026-10-20): this used to also mint a "fallback" link with
// admin.generateLink(type=recovery) right after sending. Supabase keeps only one
// recovery token per user, so that second link silently invalidated the one in
// the email, and every admin-sent reset failed with otp_expired. The fallback
// was never shown in the admin UI, so it is removed.

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

  const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : undefined;

  // (1) actually dispatch the email through our SMTP.
  // Sent with the service-role client, not anon: once Supabase Auth CAPTCHA is
  // on (#77 Turnstile), anon recover calls need a captcha token, while
  // service-role requests skip the captcha check.
  const { error: sendErr } = await admin.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (sendErr) {
    return jsonResponse(req, { ok: false, message: `SMTP send error: ${sendErr.message}` }, 500);
  }

  return jsonResponse(req, {
    ok: true,
    sent: true,
    user_id: user.id,
    email,
  });
});
