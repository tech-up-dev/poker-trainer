// Session-cap-alert Edge Function (#5).
// Called by the enforce_session_cap database trigger (via pg_net) when a member
// signs in on a third device and the least recently active one is signed out.
// Emails Steve through the Resend API. The trigger already throttles to one
// alert per member per 24 hours.
//
// Gated by a shared secret header (x-cron-secret), so it is deployed with
// --no-verify-jwt. Body `{ "dry_run": true }` returns the email it would send
// without sending it (for testing).
//
// Required env vars:
//   SESSION_CAP_ALERT_SECRET - must match Vault session_cap_alert_secret
//   RESEND_API_KEY           - sending-scoped Resend key
//   SESSION_CAP_ALERT_TO     - optional, defaults to steve@lc.beatsmallstakes.com

import { jsonResponse } from "../_shared/responses.ts";

const FROM = "Controlled Chaos Trainer <no-reply@auth.beatsmallstakes.com>";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, message: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("SESSION_CAP_ALERT_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("SESSION_CAP_ALERT_TO") ?? "steve@lc.beatsmallstakes.com";
  if (!secret || !resendKey) {
    return jsonResponse(req, { ok: false, message: "Missing required environment variables" }, 500);
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return jsonResponse(req, { ok: false, message: "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({})) as {
    email?: unknown;
    evicted?: unknown;
    dry_run?: unknown;
  };
  const member = typeof body.email === "string" ? body.email : "unknown member";
  const evicted = typeof body.evicted === "number" ? body.evicted : 1;

  const email = {
    from: FROM,
    to: [to],
    subject: `Device limit reached: ${member}`,
    text: [
      `${member} just signed in to the Controlled Chaos Trainer on a new device while already signed in on 2 others.`,
      ``,
      `The least recently used device (${evicted} in total) was signed out automatically. It may stay usable for up to an hour until its session expires.`,
      ``,
      `Repeated alerts for the same member can indicate account sharing. You get at most one alert per member per 24 hours.`,
    ].join("\n"),
  };

  if (body.dry_run === true) return jsonResponse(req, { ok: true, dry_run: true, email });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(email),
  });
  if (!res.ok) {
    return jsonResponse(req, { ok: false, message: `Resend error ${res.status}` }, 502);
  }
  return jsonResponse(req, { ok: true });
});
