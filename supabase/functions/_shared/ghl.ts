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
const CUSTOM_FIELD_IDS: Record<string, string> = {
  "contact.last_trained_date": "pgkLNSFAeJW0xRGjKhq7",
  "contact.current_streak": "5rVKcvwUA4mnSS3w1uBm",
  "contact.weakest_concept": "ekiDsFazDVtGFsOEfL5c",
  "contact.weekly_goal_progress": "Lt4zLukTOJsSd5MWK7pv",
  "contact.monthly_days_trained": "33u2it1ES8QWRI4SLw5B",
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
