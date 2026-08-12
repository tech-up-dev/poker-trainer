import { createClient } from "jsr:@supabase/supabase-js@2";

type Client = ReturnType<typeof createClient>;
export type BasicUser = { id: string; email: string };

// Exact (case-insensitive) lookup of a Supabase auth user by email. listUsers is
// paginated, so scan pages until a match or the last page. Fine for the current
// user base; revisit with a server-side filter if it grows large.
export async function findUserByEmail(admin: Client, email: string): Promise<BasicUser | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match?.email) return { id: match.id, email: match.email };
    if (data.users.length < 200) return null;
  }
  return null;
}
