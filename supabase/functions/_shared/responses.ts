import { corsHeaders } from "./cors.ts";

// JSON response with the right CORS headers for the calling request. Every
// function returns through here so the headers stay consistent.
export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

// Standard 204 reply to a CORS preflight (OPTIONS) request.
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
