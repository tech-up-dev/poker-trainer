import { contentRegistry, isContentType } from "../../../shared/schemas/content.ts";

export type RevalidationResult =
  | { ok: true }
  | { ok: false; errors: { path: string; message: string }[] };

// Server-side re-validation. The client validates before saving to staging, but
// that's a UX convenience, not a guarantee: anyone could write to staging
// directly. This re-checks the staged content against the same Zod schema the
// app uses, so nothing reaches production without passing the real gate.
//
// Only promotion runs this. Rollback restores a prior snapshot that already
// passed at promote time, and re-validating there would let a later schema
// change block recovery to a known-good version.
export function revalidateContent(
  contentType: unknown,
  content: unknown
): RevalidationResult {
  if (!isContentType(contentType)) {
    return {
      ok: false,
      errors: [{ path: "content_type", message: `Unknown content type: ${contentType}` }],
    };
  }

  const { schema } = contentRegistry[contentType];
  const result = schema.safeParse(content);
  if (result.success) return { ok: true };

  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
