-- v5: multi-tag Pro Training course gating + demo-row cutover.
--
-- Context. Steve has carried multiple purchase tags per course for years and
-- does not want to re-tag his historical contacts (that would re-fire his
-- automations), so a course has to be considered owned when the member holds
-- ANY one of its tags, not a single ghl_tag string. This migration:
--
--   1. Adds `ghl_tags text[] not null default '{}'`. GIN-indexed for cheap
--      overlap queries (`course.ghl_tags && member.tags` is the hot path).
--
--   2. Backfills `ghl_tags` from the pre-existing single `ghl_tag` column so
--      no in-flight data is lost. The legacy column is kept for one release
--      so the admin page can read-then-write; a later cleanup pass drops it.
--
--   3. Rewrites `get_owned_courses()` to overlap-match the two arrays. Still
--      security invoker, still fail-open (missing member row OR stale sync >
--      48h = owns nothing). The RLS on the two source tables already
--      restricts rows to the caller.
--
--   4. Deletes the four demo rows. Confirmed with Blagojche 2026-10-02 that
--      Steve will populate the five real courses himself through the Pro
--      Training admin page once Dejan's multi-tag input lands. The fail-open
--      design (owns nothing without a mapping) means no member sees anything
--      hidden during the empty window.
--
-- Idempotent on reruns: the column add + index are IF-NOT-EXISTS, the backfill
-- is a no-op if ghl_tags already matches, the function is CREATE OR REPLACE,
-- and the demo-row delete is a title-matched DELETE that no-ops after the
-- first run.

-- 1. New column + index.
alter table pro_training_courses
  add column if not exists ghl_tags text[] not null default '{}';

create index if not exists pro_training_courses_ghl_tags_idx
  on pro_training_courses using gin (ghl_tags);

-- 2. Backfill from the legacy single-tag column.
update pro_training_courses
   set ghl_tags = array[ghl_tag]
 where ghl_tag is not null
   and (ghl_tags is null or ghl_tags = '{}');

-- 3. Rewrite the owned-courses lookup to use array overlap.
create or replace function get_owned_courses()
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with me as (
    select tags
    from member_ghl_tags
    where user_id = auth.uid()
      and synced_at > now() - interval '48 hours'
  ),
  enabled as (
    select id, ghl_tags
    from pro_training_courses
    where enabled
  ),
  owned as (
    select e.id
    from enabled e, me
    where coalesce(array_length(e.ghl_tags, 1), 0) > 0
      and e.ghl_tags && me.tags
  )
  select jsonb_build_object(
    'owned_course_ids', coalesce((select jsonb_agg(id) from owned), '[]'::jsonb),
    'owns_all',         (select count(*) from enabled) > 0
                        and (select count(*) from owned) = (select count(*) from enabled)
  );
$function$;

-- 4. Clean cutover of the demo catalog. Steve populates the real five via the
--    admin UI once Dejan's multi-tag input is live.
delete from pro_training_courses
 where title in (
   'Controlled Chaos™ Masterclass',
   'Range Construction & GTO Foundations',
   'River Play & Big-Bet Poker',
   'Exploiting Small-Stakes Regulars',
   'Advanced 3-Betting Mastery'
 );
