// Minimal GoHighLevel (LeadConnector v2) client for the entitlement sync.
// Reads the Private Integration token + location id from Edge secrets. Only the
// two reads the sync needs: look a contact up by email, and fetch one by id.

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export type GhlContact = { id: string; email: string | null; tags: string[] };

function ghlHeaders(): HeadersInit {
  const token = Deno.env.get("GHL_API_TOKEN") ?? "";
  return {
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    Accept: "application/json",
  };
}

// One retry on transient failures (429 / 5xx). Auth and other 4xx surface
// immediately so the caller can fail open rather than silently loop.
async function ghlFetch(path: string): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}${path}`, { headers: ghlHeaders() });
    if (res.ok || (res.status !== 429 && res.status < 500)) return res;
  }
  return fetch(`${BASE}${path}`, { headers: ghlHeaders() });
}

function toContact(c: Record<string, unknown> | undefined | null): GhlContact | null {
  if (!c || typeof c.id !== "string") return null;
  return {
    id: c.id,
    email: typeof c.email === "string" ? c.email : null,
    tags: Array.isArray(c.tags) ? (c.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
  };
}

const locationId = () => Deno.env.get("GHL_LOCATION_ID") ?? "";

// Exact (case-insensitive) email lookup. The query search is fuzzy, so filter
// the results down to an exact email match.
export async function getContactByEmail(email: string): Promise<GhlContact | null> {
  const res = await ghlFetch(`/contacts/?locationId=${locationId()}&query=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error(`GHL contact search failed: ${res.status}`);
  const data = await res.json();
  const target = email.trim().toLowerCase();
  const match = (data.contacts ?? []).find(
    (c: Record<string, unknown>) => String(c.email ?? "").toLowerCase() === target,
  );
  return toContact(match ?? null);
}

export async function getContactById(id: string): Promise<GhlContact | null> {
  const res = await ghlFetch(`/contacts/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GHL contact fetch failed: ${res.status}`);
  const data = await res.json();
  return toContact(data.contact ?? null);
}

export type ContactField = { key: string; value: string | number };

// GHL v2 writes custom fields by their internal field ID, not the merge fieldKey
// (a PUT with { key, field_value } returns 200 but silently writes nothing), so we
// map fieldKey -> id here. IDs are for the connected location (X9YN3cpdM3TwR2niCEmk),
// read from GET /locations/{id}/customFields; see docs/integrations/ghl.md.
//
// v5 scope (Issue #68 §7.5): six fields pushed, two retired.
//   - KEEP:   last_trained_date, weakest_concept, monthly_days_trained
//   - RETIRE: current_streak, weekly_goal_progress (streaks + weekly goal cut
//             per §7.1 / §7.2). Keys left in the map with a `null` ID so a
//             computeFields caller never resurrects them without being seen
//             here; `updateContactFields` filters IDs that resolve to a
//             truthy string, so a nulled key is a safe no-op if a stale
//             call sends it. Delete the two map entries once we are certain
//             no older caller references them (not blocking v5).
//   - NEW:    concepts_solid_count, lesson_in_progress, live_sessions_logged.
//             Steve is creating the three fields in GHL (Settings -> Custom
//             Fields -> Contact) and will send the IDs. Until the IDs land,
//             the keys appear here with `TODO_<slug>` placeholders so a
//             prepared push just silently drops the field (updateContactFields
//             filters CUSTOM_FIELD_IDS[k] = undefined); replace each placeholder
//             with the real 20-char slug once Steve forwards it.
const CUSTOM_FIELD_IDS: Record<string, string | null> = {
  "contact.last_trained_date":    "pgkLNSFAeJW0xRGjKhq7",
  "contact.weakest_concept":      "ekiDsFazDVtGFsOEfL5c",
  "contact.monthly_days_trained": "33u2it1ES8QWRI4SLw5B",
  // v5 §7.5 new fields. IDs validated against the GHL location on 2026-10-02
  // via a one-shot probe; see Blagojche thread for the lookup trace.
  // Note the GHL field is named `lessons_in_progress` (plural) by Steve but our
  // internal key stays singular as the spec; the id is what the write uses.
  "contact.concepts_solid_count": "mv8qsCxTErFgARaJSooZ",
  "contact.lesson_in_progress":   "1SqkIZveXj2jLunM3a79",
  "contact.live_sessions_logged": "vLEUvTcwl4LJeWT2iA23",
  // Retired (v5 §7.1 / §7.2). Keys kept nulled so a stray caller is a no-op,
  // not an undefined-id crash. Remove in a cleanup pass.
  "contact.current_streak":       null,
  "contact.weekly_goal_progress": null,
};

// Write custom fields on a contact (M3-13 write-back) via the PIT. Fields come in
// keyed by fieldKey; we resolve each to its id and write by id (unknown keys are
// skipped). Retries on transient failures (429 / 5xx); a permanent 4xx returns
// false without looping.
export async function updateContactFields(contactId: string, fields: ContactField[]): Promise<boolean> {
  const customFields = fields
    .map((f) => ({ id: CUSTOM_FIELD_IDS[f.key], field_value: f.value }))
    .filter((cf) => cf.id);
  if (customFields.length === 0) return false;
  const body = JSON.stringify({ customFields });
  const headers = { ...ghlHeaders(), "Content-Type": "application/json" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}`, {
      method: "PUT",
      headers,
      body,
    });
    if (res.ok) return true;
    if (res.status !== 429 && res.status < 500) return false;
  }
  return false;
}

// --- In-app purchase CRM sync (M3-06) ---

// Upsert a contact by email (create if new, else return the existing one) so an
// in-app Stripe buyer lands in GHL. Returns the contact id, or null on failure.
// Optional firstName/lastName fold in Steve's #48: capture the buyer's name at
// checkout and land it on the GHL contact. Absent fields are simply omitted from
// the upsert body so existing callers stay identical.
export async function upsertContact(
  email: string,
  extra?: { firstName?: string | null; lastName?: string | null },
): Promise<string | null> {
  const body: Record<string, unknown> = { locationId: locationId(), email };
  if (extra?.firstName) body.firstName = extra.firstName;
  if (extra?.lastName) body.lastName = extra.lastName;
  const res = await fetch(`${BASE}/contacts/upsert`, {
    method: "POST",
    headers: { ...ghlHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const contact = (data.contact ?? data) as Record<string, unknown>;
  return typeof contact.id === "string" ? contact.id : null;
}

async function tagRequest(method: string, contactId: string, tag: string): Promise<boolean> {
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}/tags`, {
    method,
    headers: { ...ghlHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ tags: [tag] }),
  });
  return res.ok;
}

// Apply / clear a tag on a contact (M3-06). Applying the subscriber tag is what
// triggers the client's email/automation workflows.
export const addContactTag = (contactId: string, tag: string): Promise<boolean> =>
  tagRequest("POST", contactId, tag);
export const removeContactTag = (contactId: string, tag: string): Promise<boolean> =>
  tagRequest("DELETE", contactId, tag);

// List the location's live GHL tag names (M5-03). Feeds the cached admin dropdown
// for the per-course "owns this" tag. Needs the PIT Tags:read scope.
export async function getLocationTags(): Promise<string[]> {
  const res = await ghlFetch(`/locations/${locationId()}/tags`);
  if (!res.ok) throw new Error(`GHL tags list failed: ${res.status}`);
  const data = await res.json();
  const list = (data.tags ?? data.data ?? []) as Array<{ name?: string } | string>;
  return list
    .map((t) => (typeof t === "string" ? t : (t.name ?? "")))
    .filter((n) => n.length > 0);
}
