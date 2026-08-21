-- M5-05 session logging. A member's real-world live-session results, logged by the
-- member and kept honest and SEPARATE from training stats. Unlike the reward tables
-- (points/badges/streaks are server-written), this is a member-owned journal: the
-- member reads AND writes their own rows, so RLS is owner read+write. No link to
-- training data - the FE shows running totals and a trend, with no correlation
-- claims (that constraint is a display rule, enforced by keeping this isolated).
create table session_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  session_date  date not null,
  stakes        text,
  hours         numeric(6,2),
  result_amount numeric(12,2),   -- net win (+) / loss (-) for the session
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- "my sessions, newest first" is the common read.
create index session_logs_user_idx on session_logs (user_id, session_date desc);

alter table session_logs enable row level security;

-- Owner-only: the member logs and manages their own sessions.
create policy "own session logs"
  on session_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger session_logs_set_updated_at
  before update on session_logs
  for each row execute function set_updated_at();
