-- #65 follow-up: strip the "test" placeholder from get_all_concept_scores so
-- every consumer sees a clean 20-row list of Steve's canonical concepts. The
-- "test" concept was seeded by the original concept-vocabulary migration
-- (20260812010000) as a bootstrap tag for orphan content and is intentionally
-- not soft-deleted (a hard delete would break historical answer_events that
-- reference it), but it should not surface in the stats page's "How you're
-- doing" grid or in the "Right now: X of Y concepts Solid" count.
--
-- Only the get_all_concept_scores RPC filters it; get_leaks and the concepts
-- vocabulary itself are unchanged. If further placeholders are added later,
-- consider a `hidden boolean not null default false` column on concepts, but
-- for a single placeholder the inline predicate is cheaper.

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
    and c.slug <> 'test'
  order by c.sort_order;
$$;

revoke execute on function public.get_all_concept_scores() from public, anon;
grant  execute on function public.get_all_concept_scores() to   authenticated;
