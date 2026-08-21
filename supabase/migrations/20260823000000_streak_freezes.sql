-- M5-01 streak freezes. Two freezes per month, applied automatically to save a
-- streak from a single missed day. streak_freezes holds each member's available
-- freezes; a daily cron tops them up at the start of a new month (reset to 2) and
-- consumes one to bridge a single missed day so the streak survives. Server-written
-- only (the daily job); the member reads their own count for display.

create table streak_freezes (
  user_id           uuid primary key references auth.users on delete cascade,
  freezes_available int  not null default 0,
  refilled_period   text,                 -- 'YYYY_MM' of the last monthly top-up
  updated_at        timestamptz not null default now()
);

alter table streak_freezes enable row level security;

create policy "read own freezes"
  on streak_freezes for select
  using (auth.uid() = user_id);

create trigger streak_freezes_set_updated_at
  before update on streak_freezes
  for each row execute function set_updated_at();

-- Activation flag: the daily job is dormant until this is set true (at go-live),
-- so real streak state is never modified on prod before M5 QA.
insert into app_settings (key, value) values ('streak_freezes_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- Daily maintenance over every member with a streak:
--   (1) monthly top-up: on the first run of a new calendar month (per the member's
--       timezone), reset freezes_available to 2.
--   (2) bridge: if the streak would break from exactly one missed day
--       (last_active_date is two days back) and a freeze is available, consume one
--       and move last_active_date forward a day so the streak continues instead of
--       resetting. Only a single missed day is bridged per run.
create or replace function public.apply_streak_freezes()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r       record;
  v_today date;
  v_avail int;
  v_period text;
begin
  -- Dormant until enabled (streak_freezes_enabled in app_settings), so this never
  -- touches real streaks before go-live.
  if coalesce((select (value #>> '{}')::boolean from app_settings where key = 'streak_freezes_enabled'), false) is not true then
    return;
  end if;

  for r in
    select s.user_id, s.current_streak, s.last_active_date, coalesce(s.timezone, 'UTC') as tz,
           f.freezes_available as avail, f.refilled_period as period
    from user_streaks s
    left join streak_freezes f on f.user_id = s.user_id
  loop
    v_today  := (now() at time zone r.tz)::date;
    v_avail  := coalesce(r.avail, 0);
    v_period := r.period;

    -- Ensure a freezes row exists.
    if r.avail is null then
      insert into streak_freezes (user_id, freezes_available, refilled_period)
      values (r.user_id, 0, null)
      on conflict (user_id) do nothing;
    end if;

    -- (1) Monthly top-up to 2 on the first run of a new month.
    if v_period is distinct from to_char(v_today, 'YYYY_MM') then
      update streak_freezes
        set freezes_available = 2, refilled_period = to_char(v_today, 'YYYY_MM')
        where user_id = r.user_id;
      v_avail := 2;
    end if;

    -- (2) Bridge a single missed day if a freeze is available and the streak is live.
    if r.current_streak > 0
       and r.last_active_date = v_today - 2
       and v_avail > 0 then
      update user_streaks
        set last_active_date = v_today - 1, updated_at = now()
        where user_id = r.user_id;
      update streak_freezes
        set freezes_available = freezes_available - 1
        where user_id = r.user_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_streak_freezes() from public;
grant execute on function public.apply_streak_freezes() to service_role;

-- Daily at 05:30 UTC. Idempotent: drop any existing job of this name first.
create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('streak-freezes-daily');
exception when others then
  null;
end
$$;

select cron.schedule('streak-freezes-daily', '30 5 * * *', 'select public.apply_streak_freezes()');
