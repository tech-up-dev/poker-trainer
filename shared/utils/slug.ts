// Shared helpers for auto-generating content ids. Used by the save-to-staging
// Edge Function (Deno) and, where useful, the frontend. Plain string/JSON ops so
// it runs unchanged in both runtimes.

// Turn a human label into a url-safe slug: lowercase, non-alphanumerics become
// hyphens, runs collapse, edges trimmed. "Controlled Chaos™" -> "controlled-chaos",
// "3-bet" -> "3-bet", "Old Man Coffee" -> "old-man-coffee".
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Canonical JSON of an object with keys sorted recursively, optionally dropping a
// top-level key (the id field, which one side may carry and the other may not).
// Two contents that differ only in key order or in the id field compare equal.
export function stableStringify(value: unknown, omitKey?: string): string {
  return JSON.stringify(canonicalize(value, omitKey));
}

function canonicalize(value: unknown, omitKey?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v));
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (omitKey !== undefined && key === omitKey) continue;
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}
