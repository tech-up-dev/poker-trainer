-- M3-16: runtime-configurable leak panel (Definition of Done, criterion 2).
--
-- get_leaks() returns the signed-in member's "leak" concepts: rows from
-- concept_accuracy_summary (the M4-05 rolling-window table) with at least
-- leak_min_attempts attempts and accuracy at or below leak_accuracy_ceiling
-- percent. Both thresholds are read from app_settings AT QUERY TIME, so an admin
-- edit to those settings takes effect with no redeploy. Defaults (8 attempts,
-- 75 percent) apply if a setting row is missing.
--
-- Security invoker: RLS on concept_accuracy_summary already restricts rows to the
-- caller (auth.uid() = user_id), and app_settings is readable by authenticated
-- users, so the function runs safely as the signed-in member. Worst concepts
-- first (lowest accuracy), with more attempts breaking ties.

create or replace function get_leaks()
returns table (
  concept       text,
  attempts      int,
  correct       int,
  accuracy      numeric,
  prev_accuracy numeric
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  select s.concept, s.attempts, s.correct, s.accuracy, s.prev_accuracy
  from concept_accuracy_summary s
  where s.user_id = auth.uid()
    and s.attempts >= coalesce(
      (select (value #>> '{}')::int from app_settings where key = 'leak_min_attempts'), 8)
    and s.accuracy <= coalesce(
      (select (value #>> '{}')::numeric from app_settings where key = 'leak_accuracy_ceiling'), 75) / 100.0
  order by s.accuracy asc, s.attempts desc;
$$;
