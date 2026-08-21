-- M5-02 monthly qualification threshold. Effort-based participation that hands off
-- to GHL. Admin sets "train N days this month" (one configurable number); a
-- qualifying day = one completed lesson or drill (a replay counts). When a member
-- first crosses the threshold in a calendar month, push-monthly-qualification tags
-- their GHL contact monthly_qualified_{YYYY_MM} (once). No prize / draw / ranking /
-- leaderboard logic lives in the app.

-- Configurable goal targets in app_settings (admin-editable, same pattern as the
-- leak thresholds). weekly_goal_days is here too (M5-01 display target).
insert into app_settings (key, value) values
  ('monthly_goal_days', '20'::jsonb),
  ('weekly_goal_days',  '5'::jsonb)
on conflict (key) do nothing;

-- One row per (member, month) once tagged, so the GHL push fires exactly once.
create table monthly_qualifications (
  user_id   uuid not null references auth.users on delete cascade,
  period    text not null,              -- 'YYYY_MM'
  tagged_at timestamptz not null default now(),
  primary key (user_id, period)
);

alter table monthly_qualifications enable row level security;

-- Server-written only (via the Edge Function/service role); the owner may read
-- their own qualification history.
create policy "read own monthly qualifications"
  on monthly_qualifications for select
  using (auth.uid() = user_id);

-- Daily cron, same pattern as ghl-resync: the URL + shared secret live in Vault,
-- seeded out of band via set_monthly_qual_config (never in this file), so the job
-- is a harmless no-op until config is set. __upsert_vault_secret is defined by the
-- ghl-resync migration.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.set_monthly_qual_config(p_url text, p_secret text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.__upsert_vault_secret('monthly_qual_url', p_url);
  perform public.__upsert_vault_secret('monthly_qual_secret', p_secret);
end;
$$;
revoke all on function public.set_monthly_qual_config(text, text) from public;
grant execute on function public.set_monthly_qual_config(text, text) to service_role;

create or replace function public.trigger_monthly_qualification()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'monthly_qual_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'monthly_qual_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.trigger_monthly_qualification() from public;
grant execute on function public.trigger_monthly_qualification() to service_role;

-- Daily at 07:00 UTC. Idempotent: drop any existing job of this name first.
do $$
begin
  perform cron.unschedule('monthly-qualification-daily');
exception when others then
  null;
end
$$;

select cron.schedule('monthly-qualification-daily', '0 7 * * *', 'select public.trigger_monthly_qualification()');
