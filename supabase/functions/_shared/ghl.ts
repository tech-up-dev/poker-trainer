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

// Write custom fields on a contact (M3-13 write-back) via the PIT. Fields are
// referenced by their GHL field key (e.g. "contact.last_trained_date"). Retries
// on transient failures (429 / 5xx); a permanent 4xx returns false without
// looping. NOTE: the exact custom-field body shape ({ key, field_value }) should
// be confirmed against a live contact that has these fields defined.
export async function updateContactFields(contactId: string, fields: ContactField[]): Promise<boolean> {
  const body = JSON.stringify({
    customFields: fields.map((f) => ({ key: f.key, field_value: f.value })),
  });
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
