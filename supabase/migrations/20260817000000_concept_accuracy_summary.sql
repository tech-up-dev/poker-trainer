-- M4-05: "Where you're leaking" panel — summary table + rolling-window RPC.
--
-- Design: answer_events already snapshots concept at answer time (M3-08).
-- Rather than scanning the full events table on every page load, we keep a
-- small per-(user, concept) summary that is refreshed in one indexed pass
-- whenever the member visits the Stats page (or completes a session).
--
-- Rolling window: the 50 most-recent attempts within the last 90 days,
-- per concept, per user. Tiebreak rule (same accuracy): more attempts wins.
-- Minimum 8 attempts and < 75 % accuracy to appear in the leak panel.

-- ── Index ────────────────────────────────────────────────────────────────────
-- Covers the rolling-window subquery: filter by user + concept + recency,
-- ordered newest-first so the row_number() window is index-only.
create index if not exists answer_events_concept_window_idx
  on answer_events (user_id, concept, answered_at desc)
  where concept is not null;

-- ── Summary table ─────────────────────────────────────────────────────────────
create table if not exists concept_accuracy_summary (
  user_id       uuid         not null references auth.users on delete cascade,
  concept       text         not null,
  attempts      int          not null default 0,
  correct       int          not null default 0,
  -- Stored as a fraction (0–1) for easy arithmetic; display layer converts.
  accuracy      numeric(6,5) not null default 0,
  -- Accuracy from the previous refresh; null until at least one prior refresh
  -- exists or until the row is older than 1 day (so deltas are meaningful).
  prev_accuracy numeric(6,5),
  updated_at    timestamptz  not null default now(),
  primary key (user_id, concept)
);

alter table concept_accuracy_summary enable row level security;

-- Members read and the refresh function writes only their own rows.
create policy "own concept accuracy"
  on concept_accuracy_summary
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Refresh function ──────────────────────────────────────────────────────────
-- Called by the FE on Stats page load (and optionally after session complete).
-- Runs as the calling user (security invoker) so RLS on both tables applies
-- and auth.uid() resolves to the signed-in member.
create or replace function refresh_concept_accuracy()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Upsert the rolling-window accuracy for every concept the user has
  -- answered at least once in the last 90 days.
  --   • Rolling window: newest 50 attempts per concept within 90 days.
  --   • prev_accuracy is only advanced when the row is > 1 day old, so
  --     rapid page-loads don't erase a meaningful delta.
  insert into concept_accuracy_summary
         (user_id, concept, attempts, correct, accuracy, prev_accuracy, updated_at)
  select
    auth.uid(),
    concept,
    count(*)::int                                                  as attempts,
    count(*) filter (where is_correct)::int                        as correct,
    round(
      (count(*) filter (where is_correct))::numeric / count(*),
      5
    )                                                              as accuracy,
    null::numeric(6,5)                                             as prev_accuracy,
    now()
  from (
    select
      concept,
      is_correct,
      row_number() over (partition by concept order by answered_at desc) as rn
    from answer_events
    where user_id    = auth.uid()
      and concept    is not null
      and answered_at >= now() - interval '90 days'
  ) windowed
  where rn <= 50
  group by concept
  on conflict (user_id, concept) do update set
    -- Only advance prev_accuracy when the row is at least 1 day old, so the
    -- delta reflects a real learning interval rather than back-to-back loads.
    prev_accuracy = case
                      when now() - concept_accuracy_summary.updated_at > interval '1 day'
                      then concept_accuracy_summary.accuracy
                      else concept_accuracy_summary.prev_accuracy
                    end,
    attempts      = excluded.attempts,
    correct       = excluded.correct,
    accuracy      = excluded.accuracy,
    updated_at    = excluded.updated_at;

  -- Drop concepts that fell out of the 90-day window entirely.
  delete from concept_accuracy_summary
  where user_id = auth.uid()
    and concept not in (
      select distinct concept
      from answer_events
      where user_id    = auth.uid()
        and concept    is not null
        and answered_at >= now() - interval '90 days'
    );
end;
$$;
