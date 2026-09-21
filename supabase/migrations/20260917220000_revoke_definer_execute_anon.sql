-- Security fix: revoke EXECUTE from PUBLIC / anon / authenticated on the six
-- SECURITY DEFINER functions that must only be callable by the postgres role
-- (pg_cron) or the service_role (edge functions with the service key).
--
-- Background: Supabase's default GRANT EXECUTE ... TO PUBLIC leaves every
-- definer function callable via /rest/v1/rpc/<name> with just the project's
-- anon key, which is public in the client bundle. That let an anonymous
-- caller:
--   - overwrite arbitrary Vault entries via public.__upsert_vault_secret
--   - redirect the cron destination URLs and re-swap the shared secrets via
--     public.set_ghl_resync_config / public.set_monthly_qual_config, causing
--     the next cron run to POST our payload (containing the cron secret) to
--     an attacker-controlled host
--   - manually trigger the daily jobs (public.trigger_ghl_resync,
--     public.trigger_monthly_qualification, public.apply_streak_freezes),
--     abusing GHL API budget and prematurely consuming streak freezes.
--
-- Confirmed on prod 2026-09-17 via has_function_privilege() (all six returned
-- true/true for anon and authenticated). See finding F-001.
--
-- NOT touching public.award_on_progress_completion or public.handle_new_user:
--   - award_on_progress_completion is a trigger function only; Postgres refuses
--     a direct call because TG_OP / NEW are undefined outside a trigger, and
--     it needs the default trigger EXECUTE grants to fire from user_progress
--     inserts.
--   - handle_new_user is the auth.users AFTER INSERT trigger; revoking its
--     grants would break signup.

revoke execute on function public.__upsert_vault_secret(text, text)  from public, anon, authenticated;
revoke execute on function public.set_ghl_resync_config(text, text)   from public, anon, authenticated;
revoke execute on function public.set_monthly_qual_config(text, text) from public, anon, authenticated;
revoke execute on function public.trigger_ghl_resync()                from public, anon, authenticated;
revoke execute on function public.trigger_monthly_qualification()     from public, anon, authenticated;
revoke execute on function public.apply_streak_freezes()              from public, anon, authenticated;
