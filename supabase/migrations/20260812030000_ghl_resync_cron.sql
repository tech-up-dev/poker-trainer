-- M3-14 #3: schedule the ghl-resync safety-net sweep with pg_cron + pg_net.
--
-- A daily cron runs trigger_ghl_resync(), which reads the resync URL + shared
-- secret from Vault and POSTs the ghl-resync Edge Function. Config lives in Vault
-- (seeded out of band per project via set_ghl_resync_config, never in this file),
-- so this migration is a harmless no-op on any project that has not been seeded
-- (e.g. staging): no config, no POST.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Internal Vault upsert helper (create-or-update by name).
create or replace function public.__upsert_vault_secret(p_name text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name, 'ghl resync config');
  else
    perform vault.update_secret(v_id, p_value);
  end if;
end;
$$;

-- Trusted setter to seed/rotate the resync config. Service-role only, so the
-- values are supplied at call time and never written into a migration.
create or replace function public.set_ghl_resync_config(p_url text, p_secret text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.__upsert_vault_secret('ghl_resync_url', p_url);
  perform public.__upsert_vault_secret('ghl_resync_secret', p_secret);
end;
$$;

revoke all on function public.__upsert_vault_secret(text, text) from public;
revoke all on function public.set_ghl_resync_config(text, text) from public;
grant execute on function public.set_ghl_resync_config(text, text) to service_role;

-- Reads config from Vault and pings ghl-resync. No config seeded => no-op.
create or replace function public.trigger_ghl_resync()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'ghl_resync_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'ghl_resync_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-resync-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.trigger_ghl_resync() from public;
grant execute on function public.trigger_ghl_resync() to service_role;

-- Daily at 06:00 UTC. Idempotent: drop any existing job of this name first.
do $$
begin
  perform cron.unschedule('ghl-resync-daily');
exception when others then
  null;
end
$$;

select cron.schedule('ghl-resync-daily', '0 6 * * *', 'select public.trigger_ghl_resync()');
