// Admin-send-recovery Edge Function (M3 follow-up 5b).
// Admin-gated: lets a support/admin trigger a real password-recovery email for a
// member (typical support case: "member forgot their password, help me send them
// a reset link"). Two steps:
//   (1) anon.auth.resetPasswordForEmail  - dispatches the standard recovery
//       email through our configured SMTP (Resend). This IS the send.
//   (2) admin.auth.admin.generateLink(type=recovery)  - mints an extra link the
//       admin FE can show as an out-of-band fallback (Slack DM, etc) if the
//       member reports the email never arrived. NOTE: generateLink alone does
//       NOT send an email via SMTP (docs: "It's up to you to send this email
//       using your own SMTP server."); that is why we also call
//       resetPasswordForEmail above.

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key || !anonKey) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }

  const admin = createClient(url, key);
  const anon = createClient(url, anonKey);

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
  const { error: sendErr } = await anon.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (sendErr) {
    return jsonResponse(req, { ok: false, message: `SMTP send error: ${sendErr.message}` }, 500);
  }

  // (2) mint a fallback action_link the admin UI can copy out-of-band. Best-
  //     effort: if this step fails we still consider the recovery sent.
  let actionLink: string | null = null;
  try {
    const { data } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    actionLink = data?.properties?.action_link ?? null;
  } catch {
    actionLink = null;
  }

  return jsonResponse(req, {
    ok: true,
    sent: true,
    user_id: user.id,
    email,
    action_link: actionLink,
  });
});
