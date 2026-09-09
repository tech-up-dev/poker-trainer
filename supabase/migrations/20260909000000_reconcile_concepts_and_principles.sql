-- M4 item 1 (Skills Path principle rollup) + #55 concept vocabulary fix.
--
-- Two things in one pass:
--   (a) Slug reconciliation. Steve's authored content tags questions with
--       hyphenated slugs like `facing-3-bets` and `playing-3-bet-pots`; the seed
--       had them without the internal hyphen (`facing-3bets`, `playing-3bet-pots`),
--       so save-to-staging's concept-vocabulary check rejected his lessons with
--       422 Unknown concept (#55). We insert the correct slug, retag any existing
--       content that references the old one across content_staging AND
--       content_published, then soft-delete the old row so the vocabulary drops it
--       while historical answer_events can still resolve the display name.
--   (b) Principle rollup. Skills Path (M4 item 1) shows Steve's 5 Controlled Chaos
--       principles at the top level with concepts grouped under them. Rather than
--       add a per-question field, we carry the principle on the concept itself
--       (set once when the concept is added). A small principles table holds the
--       five, and concepts gain principle_slug -> principles(slug) so the Skills
--       Path can roll up with a single join. FE reads both.
--
-- Idempotent: all inserts are ON CONFLICT DO NOTHING/UPDATE; the slug rename runs
-- via a helper function that no-ops when the source concept is already gone or
-- already soft-deleted, so re-running the migration is a no-op.

-- 1. Slug rename helper. Retags every question tagged with from_slug onto to_slug
--    (both the question-level `concept` and the lesson-level `concept`) across
--    content_staging and content_published, then soft-deletes the old concept.
--    Dropped at the end of this migration; a real rename tool lives at
--    supabase/functions/reassign-concept for admin use.

create or replace function pg_temp._reconcile_slug(from_slug text, to_slug text)
returns void language plpgsql as $body$
declare
  tbl text;
  row_id text;
  lesson jsonb;
  new_lesson jsonb;
  new_questions jsonb;
  q jsonb;
begin
  if not exists (select 1 from concepts where slug = from_slug and deleted_at is null) then
    return;
  end if;

  -- Ensure the target concept exists (copy metadata from the source if it does not).
  insert into concepts (slug, name, description, sort_order)
  select to_slug, name, description, sort_order from concepts where slug = from_slug
  on conflict (slug) do nothing;

  foreach tbl in array array['content_staging', 'content_published'] loop
    for row_id, lesson in execute format(
      'select content_id, content from %I where content_type = ''lesson''', tbl
    )
    loop
      new_lesson := lesson;

      if lesson->>'concept' = from_slug then
        new_lesson := jsonb_set(new_lesson, '{concept}', to_jsonb(to_slug));
      end if;

      new_questions := '[]'::jsonb;
      for q in select value from jsonb_array_elements(coalesce(new_lesson->'questions', '[]'::jsonb)) loop
        if q->>'concept' = from_slug then
          q := jsonb_set(q, '{concept}', to_jsonb(to_slug));
        end if;
        new_questions := new_questions || q;
      end loop;
      new_lesson := jsonb_set(new_lesson, '{questions}', new_questions);

      if new_lesson is distinct from lesson then
        execute format(
          'update %I set content = $1, updated_at = now() where content_id = $2 and content_type = ''lesson''',
          tbl
        ) using new_lesson, row_id;
      end if;
    end loop;
  end loop;

  update concepts set deleted_at = now() where slug = from_slug and deleted_at is null;
end
$body$;

select pg_temp._reconcile_slug('facing-3bets', 'facing-3-bets');
select pg_temp._reconcile_slug('playing-3bet-pots', 'playing-3-bet-pots');

-- 2. Principles table. Five rows, seeded from Steve's Controlled Chaos model.
create table if not exists principles (
  slug        text        primary key,
  name        text        not null,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

alter table principles enable row level security;

drop policy if exists "principles_select" on principles;
create policy "principles_select"
  on principles for select
  using (auth.role() = 'authenticated');

insert into principles (slug, name, sort_order) values
  ('strategic-3-betting',            'Strategic 3-Betting',              1),
  ('character-mapping',              'Character Mapping',                2),
  ('equity-flow',                    'Equity Flow',                      3),
  ('simple-math-for-big-stacks',     'Simple Math for Big Stacks',       4),
  ('building-winning-monster-pots',  'Building & Winning Monster Pots',  5)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- 3. principle_slug on concepts.
alter table concepts add column if not exists principle_slug text
  references principles(slug) on delete set null;

-- 4. Backfill the concept -> principle mapping (Blagojche's authoritative map).
--    Uses the reconciled (post-rename) slugs.
update concepts set principle_slug = 'strategic-3-betting'
  where slug in ('3-betting','playing-3-bet-pots','facing-3-bets','squeezing','isolating-limpers','blind-defense');

update concepts set principle_slug = 'character-mapping'
  where slug in ('character-mapping','hand-reading','bluff-catching');

update concepts set principle_slug = 'equity-flow'
  where slug in ('floating','playing-draws','odds-equity');

update concepts set principle_slug = 'simple-math-for-big-stacks'
  where slug in ('bet-sizing','board-texture','multiway-pots');

update concepts set principle_slug = 'building-winning-monster-pots'
  where slug in ('value-betting','barreling','c-betting','check-raising','table-image');
