-- Per-user state tables (issue #17, remaining scope).
--
-- The auth-adjacent core (user_profiles, entitlements, answer_events) shipped in
-- 20260621120000. This adds the member-owned state the later milestones build on:
--   user_progress         - per-content progress + accuracy (quiz engine, M2)
--   user_streaks          - daily streak tracking (M4)
--   user_saved_questions  - starred questions (M2)
--   user_saved_tips       - saved "Today's Tip" entries (M2)
--   user_badges           - earned achievement badges (M4)
--
-- Schema only. No gamification logic (streak/badge rules land in M4) and no
-- Stripe wiring. The columns and RLS exist now so the member app can be built
-- against the final shape instead of being reshaped later. set_updated_at() and
-- the pgcrypto extension already exist from the 20260621120000 migration.

-- One row per (member, content). The quiz engine upserts this as a member works
-- through a lesson; content_type mirrors the content pipeline discriminator so the
-- same table can track progress for any future quizable content type.
create table user_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  content_id         text not null,
  content_type       text not null default 'lesson',
  questions_answered int  not null default 0,
  questions_correct  int  not null default 0,
  completed          boolean not null default false,
  last_attempted_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, content_id, content_type)
);

-- "my progress, newest activity first" is the common read.
create index user_progress_user_idx on user_progress (user_id);

-- One row per member. last_active_date plus timezone is enough to decide whether
-- today's activity extends or breaks the streak; the rule itself lives in M4.
create table user_streaks (
  user_id          uuid primary key references auth.users on delete cascade,
  current_streak   int  not null default 0,
  longest_streak   int  not null default 0,
  last_active_date date,
  timezone         text not null default 'UTC',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Starred questions. Keyed by (content_id, question_id) since question ids are
-- only unique within their lesson. The unique constraint makes save idempotent.
create table user_saved_questions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  content_id  text not null,
  question_id text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, content_id, question_id)
);

create index user_saved_questions_user_idx on user_saved_questions (user_id);

-- Saved "Today's Tip" entries. tip_id is globally unique, so that plus user is
-- enough; the unique constraint keeps save idempotent.
create table user_saved_tips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  tip_id     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, tip_id)
);

create index user_saved_tips_user_idx on user_saved_tips (user_id);

-- Earned badges. badge_key identifies the achievement (the catalogue of keys and
-- the award rules land in M4); one row per (member, badge) via the unique.
create table user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  badge_key  text not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index user_badges_user_idx on user_badges (user_id);

-- Keep updated_at honest on the two mutable tables (reuses the existing function).
create trigger user_progress_set_updated_at
  before update on user_progress
  for each row execute function set_updated_at();

create trigger user_streaks_set_updated_at
  before update on user_streaks
  for each row execute function set_updated_at();

-- RLS: default-deny, owner-only. Every row belongs to one member and only that
-- member can read or write it (auth.uid() = user_id). Server-driven writes (e.g.
-- the M4 badge/streak jobs) run as the service role, which bypasses RLS.
alter table user_progress        enable row level security;
alter table user_streaks         enable row level security;
alter table user_saved_questions enable row level security;
alter table user_saved_tips      enable row level security;
alter table user_badges          enable row level security;

create policy "own progress"
  on user_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own streaks"
  on user_streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own saved questions"
  on user_saved_questions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own saved tips"
  on user_saved_tips for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own badges"
  on user_badges for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
