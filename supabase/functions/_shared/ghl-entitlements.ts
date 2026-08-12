import { createClient } from "jsr:@supabase/supabase-js@2";

type Client = ReturnType<typeof createClient>;

export type ReconcileResult = { action: "granted" | "cancelled" | "noop" };

// Apply the quiz_app_access entitlement from a contact's GHL tags. Add-only and
// fail-open per the cross-cutting decision: grant when the subscriber tag is
// present, cancel only on an explicit cancelled tag, and otherwise leave the
// current state alone (tag absence is never treated as a revoke). Every write
// carries source "ghl:<contactId>" so a sync-driven grant is distinguishable
// from a manual one. The row is never deleted, only status-flipped.
export async function reconcileEntitlement(
  prod: Client,
  userId: string,
  tags: string[],
  contactId: string,
): Promise<ReconcileResult> {
  const subscriberTag = (Deno.env.get("GHL_SUBSCRIBER_TAG") ?? "bss-subscriber").toLowerCase();
  const cancelledTag = (Deno.env.get("GHL_CANCELLED_TAG") ?? "bss-cancelled").toLowerCase();
  const held = tags.map((t) => t.toLowerCase());
  const now = new Date().toISOString();
  const source = `ghl:${contactId}`;

  if (held.includes(subscriberTag)) {
    await prod.from("entitlements").upsert(
      { user_id: userId, entitlement_key: "quiz_app_access", status: "active", source, updated_at: now },
      { onConflict: "user_id,entitlement_key" },
    );
    return { action: "granted" };
  }

  if (held.includes(cancelledTag)) {
    await prod
      .from("entitlements")
      .update({ status: "cancelled", source, updated_at: now })
      .eq("user_id", userId)
      .eq("entitlement_key", "quiz_app_access");
    return { action: "cancelled" };
  }

  return { action: "noop" };
}
