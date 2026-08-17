-- M4-03 gamification schema (streak / points / badges / stats dashboard).
--
-- The member-owned state core shipped in 20260630120000 (user_streaks,
-- user_badges, user_progress). M4-03 adds the points ledger, aligns the badge
-- column names to the FE contract, adds the denormalized points total to the
-- per-user summary row, and tightens RLS on the reward tables so the client can
-- READ its own rows but never WRITE them.
--
-- Points, badges and streaks are awarded server-side (Edge Function or trigger
-- running as the service role, which bypasses RLS). user_progress intentionally
-- stays client-writable: it records the member's own quiz activity, not a
-- reward, and the M2 quiz engine upserts it directly.

-- 1. Points ledger. Append-only: one row per points-earning event. The running
--    total is sum(points) over a member's rows; the denormalized fast-read copy
--    lives on user_streaks.total_points, maintained by the same server write.
create table points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  points     int  not null,
  reason     text not null,          -- e.g. lesson_complete, drill_complete
  created_at timestamptz not null default now()
);

-- "my points, newest first" and the running sum() both scan by user.
create index points_ledger_user_idx on points_ledger (user_id, created_at desc);

-- 2. Align badge column names to the FE contract (table has no rows yet).
alter table user_badges rename column badge_key to badge_slug;
alter table user_badges rename column awarded_at to earned_at;

-- 3. Denormalized lifetime points on the per-user summary row. current_streak,
--    longest_streak and last_active_date already live on user_streaks; this
--    makes that one row the dashboard's single fast read.
alter table user_streaks add column total_points int not null default 0;

-- 4. Tighten RLS on the reward tables: the owner may SELECT its own rows, and no
--    one may write through the anon/authenticated roles. Dropping the old
--    "for all" policies removes the client's INSERT/UPDATE/DELETE ability; the
--    service role (server jobs) bypasses RLS and remains the only writer.
drop policy if exists "own streaks" on user_streaks;
create policy "read own streaks"
  on user_streaks for select
  using (auth.uid() = user_id);

drop policy if exists "own badges" on user_badges;
create policy "read own badges"
  on user_badges for select
  using (auth.uid() = user_id);

alter table points_ledger enable row level security;
create policy "read own points"
  on points_ledger for select
  using (auth.uid() = user_id);
