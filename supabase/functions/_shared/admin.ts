import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Thrown when the admin check fails. status is the HTTP status the caller should
// return (401 for "who are you", 403 for "not allowed").
export class AdminError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AdminError";
  }
}

// Admin gate for the CMS Edge Functions.
//
// Enforcement is opt-in: it does nothing unless REQUIRE_ADMIN is "true". Member
// auth doesn't exist until M3, and the validator currently calls these functions
// unauthenticated, so enabling the gate now would break the working pipeline.
// The check itself is finished and tested so M3 only has to flip the env var.
//
// When enabled, it verifies the caller's JWT and that they hold an active
// 'admin_access' entitlement. Pass a service-role client so the entitlement
// lookup isn't blocked by RLS.
export async function assertAdmin(
  req: Request,
  prod: SupabaseClient
): Promise<void> {
  if (Deno.env.get("REQUIRE_ADMIN") !== "true") return;

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw new AdminError(401, "Missing Authorization header");

  const {
    data: { user },
    error,
  } = await prod.auth.getUser(token);
  if (error || !user) throw new AdminError(401, "Invalid or expired token");

  const now = new Date().toISOString();
  const { data: entitlement } = await prod
    .from("entitlements")
    .select("entitlement_key")
    .eq("user_id", user.id)
    .eq("entitlement_key", "admin_access")
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (!entitlement) throw new AdminError(403, "Admin access required");
}
