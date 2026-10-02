-- v5 §7.1 / §7.2: retire the streak + weekly-goal mechanics. Steve's product
-- feedback cut both after the monthly goal landed, since the daily streak and
-- weekly goal measure the same thing in a harsher way.
--
-- Deactivation here, not deletion: `streak_freezes` and `apply_streak_freezes`
-- are kept in the schema so historical rows survive (members may have accrued
-- freezes between the 2026-09-17 activation and today). A later cleanup pass
-- can drop both once a retention window has passed. This migration only stops
-- the mechanics from running.
--
-- Idempotent: both statements no-op if the setting is already false or the
-- cron job is already removed. Safe to re-run.

-- 1. Flip the gate flag so apply_streak_freezes() returns early on every call,
--    even if the cron is re-enabled by mistake. `app_settings` has no updated_at
--    column, so this is a straight value flip.
update app_settings
   set value = 'false'::jsonb
 where key = 'streak_freezes_enabled';

-- 2. Remove the daily pg_cron schedule entirely. cron.unschedule returns a
--    boolean; wrapping in a block swallows the "job not found" error on a
--    second run so the migration stays idempotent.
do $$
begin
  perform cron.unschedule('streak-freezes-daily');
exception
  when others then
    null;
end $$;
