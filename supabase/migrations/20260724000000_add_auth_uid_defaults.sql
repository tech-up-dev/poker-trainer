-- Add auth.uid() as default for user_id on saved-content tables so client
-- upserts don't need to send user_id explicitly. RLS with check still enforces
-- that the row belongs to the authenticated user.
alter table user_saved_questions alter column user_id set default auth.uid();
alter table user_saved_tips      alter column user_id set default auth.uid();
