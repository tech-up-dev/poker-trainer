import { createClient } from "jsr:@supabase/supabase-js@2";

type Client = ReturnType<typeof createClient>;

export type ReconcileResult = { action: "granted" | "cancelled" };

const KEY = "quiz_app_access";

function subscriberTag(): string {
  return (Deno.env.get("GHL_SUBSCRIBER_TAG") ?? "app_subscriber_active").toLowerCase();
}

// Add-only grant: upsert the access entitlement to active. The row is kept and a
// source is stamped so a GHL-driven grant is distinguishable from a manual one.
export async function grantAccess(prod: Client, userId: string, contactId: string): Promise<void> {
  await prod.from("entitlements").upsert(
    {
      user_id: userId,
      entitlement_key: KEY,
      status: "active",
      source: `ghl:${contactId}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entitlement_key" },
  );
}

// Soft cancel: a targeted update that only touches an existing active grant, so a
// contact who never subscribed never gets a spurious cancelled row.
export async function cancelAccess(prod: Client, userId: string, contactId: string): Promise<void> {
  await prod
    .from("entitlements")
    .update({ status: "cancelled", source: `ghl:${contactId}`, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("entitlement_key", KEY);
}

// Reconcile from the contact's CURRENT tags (authoritative): the access tag
// present grants, its absence cancels. Used after a re-fetch in the webhook and
// by the resync sweep. Fail-open is the caller's job: only call this once the GHL
// read has succeeded, so a read failure never revokes.
export async function reconcileFromTags(
  prod: Client,
  userId: string,
  tags: string[],
  contactId: string,
): Promise<ReconcileResult> {
  if (tags.map((t) => t.toLowerCase()).includes(subscriberTag())) {
    await grantAccess(prod, userId, contactId);
    return { action: "granted" };
  }
  await cancelAccess(prod, userId, contactId);
  return { action: "cancelled" };
}

// Reconcile from an explicit add/remove signal in the webhook payload, used as a
// fallback when the authoritative re-fetch is unavailable.
export async function reconcileFromAction(
  prod: Client,
  userId: string,
  add: boolean,
  contactId: string,
): Promise<ReconcileResult> {
  if (add) {
    await grantAccess(prod, userId, contactId);
    return { action: "granted" };
  }
  await cancelAccess(prod, userId, contactId);
  return { action: "cancelled" };
}

// Record a member's current GHL tags (M5-03), so the app can hide Pro Training
// courses they already own without re-hitting GHL. Called from the same
// reconcile paths (webhook + resync) that already hold the contact's tags.
export async function recordMemberTags(prod: Client, userId: string, tags: string[]): Promise<void> {
  await prod.from("member_ghl_tags").upsert(
    { user_id: userId, tags, synced_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}
