-- #5: at most 2 signed-in devices per member account.
--
-- When a new session is created (any sign-in, including a password reset link),
-- the member's sessions beyond the 2 most recently active are deleted. Deleting
-- the session revokes its refresh tokens, so the evicted device is signed out
-- when its current access token expires (up to 1 hour, accepted by Blagojche
-- 2026-10-19; token lifetime is intentionally unchanged).
--
-- Each eviction is logged in session_cap_events. At most once per member per
-- 24 hours, an alert is posted to the session-cap-alert Edge Function, which
-- emails Steve. The function URL and shared secret live in Vault
-- (session_cap_alert_url / session_cap_alert_secret), same pattern as the
-- monthly qualification job.
--
-- Admins are exempt so the team and Steve are never locked out of the CMS.
-- Any error is swallowed: the cap must never block a sign-in.

create table if not exists session_cap_events (
  id                  bigserial   primary key,
  user_id             uuid        not null references auth.users on delete cascade,
  evicted_session_ids uuid[]      not null,
  alerted             boolean     not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists session_cap_events_user_idx on session_cap_events (user_id, created_at desc);

alter table session_cap_events enable row level security;
revoke all on session_cap_events from anon, authenticated;

create or replace function public.enforce_session_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evicted uuid[];
  v_recent  boolean;
  v_url     text;
  v_secret  text;
  v_email   text;
begin
  if exists (
    select 1 from public.entitlements e
    where e.user_id = new.user_id
      and e.entitlement_key = 'admin_access'
      and e.status = 'active'
  ) then
    return new;
  end if;

  select array_agg(r.id) into v_evicted
  from (
    select s.id,
           row_number() over (
             order by greatest(
               coalesce(s.refreshed_at at time zone 'UTC', '-infinity'::timestamptz),
               coalesce(s.updated_at, '-infinity'::timestamptz),
               coalesce(s.created_at, '-infinity'::timestamptz)
             ) desc
           ) as rn
    from auth.sessions s
    where s.user_id = new.user_id
      and s.id <> new.id
      and (s.not_after is null or s.not_after > now())
  ) r
  -- the new session takes one of the 2 slots, so keep only 1 other
  where r.rn > 1;

  if v_evicted is null then
    return new;
  end if;

  delete from auth.sessions where id = any (v_evicted);

  select exists (
    select 1 from public.session_cap_events
    where user_id = new.user_id and alerted and created_at > now() - interval '24 hours'
  ) into v_recent;

  insert into public.session_cap_events (user_id, evicted_session_ids, alerted)
  values (new.user_id, v_evicted, not v_recent);

  if not v_recent then
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'session_cap_alert_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'session_cap_alert_secret';
    if v_url is not null and v_secret is not null then
      select email into v_email from auth.users where id = new.user_id;
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
        body := jsonb_build_object('user_id', new.user_id, 'email', v_email, 'evicted', array_length(v_evicted, 1))
      );
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.enforce_session_cap() from public, anon, authenticated;

drop trigger if exists enforce_session_cap on auth.sessions;
create trigger enforce_session_cap
  after insert on auth.sessions
  for each row execute function public.enforce_session_cap();
