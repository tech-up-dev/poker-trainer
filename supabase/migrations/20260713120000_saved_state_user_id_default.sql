-- Default user_id to the caller on the member "saved" tables.
--
-- Both tables are owner-only under RLS (`auth.uid() = user_id`), so an insert has
-- always had to carry user_id explicitly or the WITH CHECK fails. Defaulting the
-- column to auth.uid() lets the client insert just the content keys and still
-- satisfy the policy, which removes a whole class of "new row violates row-level
-- security policy" errors when saving a question or a tip.
--
-- RLS is unchanged: the policy still enforces auth.uid() = user_id, so this only
-- fills in the value, it does not widen who can write.

alter table user_saved_questions alter column user_id set default auth.uid();
alter table user_saved_tips      alter column user_id set default auth.uid();
