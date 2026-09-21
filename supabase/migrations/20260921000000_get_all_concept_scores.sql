-- #65 stats-page redesign: single RPC that returns EVERY concept with the
-- caller's current-window score, previous score, and a Steve-defined band.
--
-- Feeds the "How you're doing" grid on /play/stats: all 20 concepts (post-slug
-- reconciliation, `deleted_at is null`), grouped into four bands with a delta
-- against the last-refresh snapshot.
--
-- Reuses the M4 rolling-window snapshot table `concept_accuracy_summary` (50
-- most-recent attempts within 90 days, per M4-05). Left-joins from the
-- authoritative `concepts` vocabulary so a member who has never answered a
-- concept still gets a row with `band = 'not_enough'`.
--
-- Bands (matching Steve's #65 spec):
--   not_enough    : fewer than `leak_min_attempts` attempts (default 8), incl. 0
--   needs_work    : ≥ threshold attempts AND accuracy < 0.50
--   getting_there : ≥ threshold attempts AND 0.50 ≤ accuracy < 0.75
--   solid         : ≥ threshold attempts AND accuracy ≥ 0.75
--
-- Thresholds:
--   - min-attempts is read from `app_settings.leak_min_attempts` (default 8) so
--     admin changes propagate here identically to `get_leaks()`.
--   - 0.50 and 0.75 band cut-lines are hard-coded to Steve's spec. 0.75 also
--     matches the current `leak_accuracy_ceiling` default; if an admin edits
--     that setting the "solid" line here does NOT automatically move — do the
--     coupling explicitly in a follow-up if that is intended.
--
-- Security-invoker: RLS on `concept_accuracy_summary` already restricts rows
-- to `auth.uid() = user_id`, `concepts` is readable by every authenticated
-- role, and `app_settings` too. So the function runs safely under the caller's
-- own privileges - no service_role escalation.

create or replace function get_all_concept_scores()
returns table (
  concept        text,
  name           text,
  principle_slug text,
  attempts       int,
  correct        int,
  accuracy       numeric,
  prev_accuracy  numeric,
  band           text
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  with threshold as (
    select coalesce(
      (select (value #>> '{}')::int from app_settings where key = 'leak_min_attempts'),
      8
    ) as min_attempts
  )
  select
    c.slug                         as concept,
    c.name                         as name,
    c.principle_slug               as principle_slug,
    coalesce(s.attempts, 0)        as attempts,
    coalesce(s.correct, 0)         as correct,
    s.accuracy                     as accuracy,
    s.prev_accuracy                as prev_accuracy,
    case
      when coalesce(s.attempts, 0) < (select min_attempts from threshold) then 'not_enough'
      when s.accuracy < 0.50 then 'needs_work'
      when s.accuracy < 0.75 then 'getting_there'
      else 'solid'
    end                            as band
  from concepts c
  left join concept_accuracy_summary s
    on s.concept = c.slug
    and s.user_id = auth.uid()
  where c.deleted_at is null
  order by c.sort_order;
$$;

-- Default Postgres grant to PUBLIC also lands on anon + authenticated. Keep the
-- RPC callable by any authenticated member (owner RLS on the underlying tables
-- is the real gate); revoke from anon to avoid a wasted PostgREST hit that
-- always returns 0 rows (auth.uid() is null).
revoke execute on function public.get_all_concept_scores() from public, anon;
grant  execute on function public.get_all_concept_scores() to   authenticated;
