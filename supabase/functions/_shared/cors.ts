// CORS headers for the CMS Edge Functions.
//
// Set ALLOWED_ORIGINS (comma-separated, exact origins) on the production project
// to lock requests down to the real staging and prod Vercel domains. While it's
// unset - local dev and the current staging setup - we fall back to "*" so the
// existing validator keeps working before the domains are pinned. This is the
// CORS-tightening deferred item: flip it on by setting the env var, no code change.
export function corsHeaders(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
    Vary: "Origin",
  };

  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) {
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }

  const allowList = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const origin = req.headers.get("Origin") ?? "";
  // Echo the caller's origin when it's on the list; otherwise fall back to the
  // first configured origin so the browser gets a definite, non-matching value
  // rather than a wildcard.
  const allowOrigin = allowList.includes(origin) ? origin : allowList[0] ?? "";

  return { ...base, "Access-Control-Allow-Origin": allowOrigin };
}
