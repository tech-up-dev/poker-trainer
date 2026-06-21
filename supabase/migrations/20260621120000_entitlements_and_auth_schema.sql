-- M1 foundation: the auth-adjacent schema every member-facing feature builds on.
--
-- Three tables, all keyed off Supabase Auth (auth.users):
--   user_profiles  - one row per member, holds the Stripe customer link
--   entitlements   - what a member is allowed to access (the access model)
--   answer_events  - append-only log of every quiz answer
--
-- entitlements is the one that matters. We gate access on entitlements rather
-- than on "is there an active Stripe subscription" so that multiple price points
-- (and later whole new products like the Masterclass) all collapse to a single
-- access check with no code changes. This is the "entitlements over subscription
-- status" decision from the proposal.
--
-- The Stripe fields and the GHL sync that fill these rows land in M3. The columns
-- exist now so the member app and the RLS policies can be built against the final
-- shape instead of being reshaped later.

-- gen_random_uuid() comes from pgcrypto; pg_trgm backs the glossary fuzzy search
-- in M2; vector (pgvector) is switched on now so the later AI work is purely
-- additive and never needs a migration just to enable the extension.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

-- One profile per authenticated user. The trigger further down creates this row
-- automatically on sign-up, so the app never inserts it by hand.
create table user_profiles (
  user_id            uuid primary key references auth.users on delete cascade,
  full_name          text,
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The access model. Primary key is the (user, key) pair, which makes a grant
-- naturally idempotent: the Stripe webhook can upsert on every event without
-- ever creating a duplicate row.
--
-- entitlement_key values:
--   'quiz_app_access' - the paid product, granted by an active subscription
--   'admin_access'    - CMS / validator access, granted by hand to Steve + admins
--
-- A member has access while status = 'active' and expires_at is either null or in
-- the future. expires_at lets a cancelled subscription keep access until the end
-- of the paid period without a scheduled job having to flip anything.
create table entitlements (
  user_id                uuid not null references auth.users on delete cascade,
  entitlement_key        text not null,
  status                 text not null default 'active',
  source                 text,
  stripe_subscription_id text,
  stripe_price_id        text,
  granted_at             timestamptz not null default now(),
  expires_at             timestamptz,
  updated_at             timestamptz not null default now(),
  primary key (user_id, entitlement_key),
  constraint entitlements_status_check
    check (status in ('active', 'cancelled', 'past_due'))
);

-- Covers the hot path: "does this user currently have an active entitlement".
create index entitlements_user_active_idx
  on entitlements (user_id)
  where status = 'active';

-- Every answer a member submits, written once and never updated. Powers the
-- progress and stats screens today and is the training signal for adaptive
-- recommendations later. selected_answer_index points at the chosen option in the
-- question's answers array; it stays nullable to leave room for future question
-- types that aren't a straight 4-way choice.
create table answer_events (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  lesson_id             text not null,
  question_id           text not null,
  is_correct            boolean not null,
  selected_answer_index int,
  time_taken_ms         int,
  answered_at           timestamptz not null default now()
);

-- Stats queries are nearly always "this member's history, newest first".
create index answer_events_user_answered_at_idx
  on answer_events (user_id, answered_at desc);

-- Per-question analytics (success rate, effective difficulty) read across users.
create index answer_events_question_idx
  on answer_events (question_id);

-- Keep updated_at honest on the two mutable tables rather than trusting callers
-- to set it.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_set_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

create trigger entitlements_set_updated_at
  before update on entitlements
  for each row execute function set_updated_at();

-- Auto-provision a profile row for every new auth user. security definer so the
-- trigger can write into public.user_profiles from the auth schema's context;
-- search_path is pinned so unqualified names can't resolve somewhere unexpected.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS. Default-deny on all three; members reach only their own rows. Anything
-- that writes entitlements (the Stripe webhook in M3) runs as the service role,
-- which bypasses RLS, so there is deliberately no client write policy here.
alter table user_profiles enable row level security;
alter table entitlements  enable row level security;
alter table answer_events enable row level security;

-- A member can read and edit their own profile (display name, etc.). The Stripe
-- customer id is written by the service role, not the browser.
create policy "own profile read"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy "own profile update"
  on user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Members read their own entitlements to drive in-app access checks. No write
-- policy: only the service role mutates entitlements.
create policy "own entitlements read"
  on entitlements for select
  using (auth.uid() = user_id);

-- Members append their own answers and read their own history. No update/delete
-- policy keeps the log append-only.
create policy "own answers insert"
  on answer_events for insert
  with check (auth.uid() = user_id);

create policy "own answers read"
  on answer_events for select
  using (auth.uid() = user_id);

-- 'admin_access' is granted by hand, e.g.
--   insert into entitlements (user_id, entitlement_key, source)
--   values ('<steve-user-id>', 'admin_access', 'manual');
-- The CMS Edge Functions verify this key server-side (wired up in M2).
