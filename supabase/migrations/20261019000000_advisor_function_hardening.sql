-- #77: Supabase Security Advisor warnings on prod (2026-10-19).
--
-- 1. handle_new_user() and award_on_progress_completion() are SECURITY DEFINER
--    trigger functions that were also callable over /rest/v1/rpc by anon and
--    authenticated. Triggers fire regardless of EXECUTE grants (the privilege is
--    only checked when the trigger is created), so revoking API access changes
--    nothing for signup or badge awards.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.award_on_progress_completion() from public, anon, authenticated;

-- 2. Pin search_path on the two functions the advisor flags as mutable, so a
--    caller can't shadow the tables they use with objects in another schema.
alter function public.set_updated_at() set search_path = public;
alter function public.next_content_seq(text) set search_path = public;
