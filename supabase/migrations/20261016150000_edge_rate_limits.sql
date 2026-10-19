-- #77 / audit F-013: per-IP rate limit for the anonymous Edge Functions
-- (create-checkout-session, post-purchase-signin). Without it, a script could
-- call them in a loop and burn Stripe API quota.
--
-- Fixed one-minute-style windows: each (bucket, window_start) row counts hits.
-- Only the service role (the Edge Functions) can touch the table or call the
-- function; members and anon cannot.
create table if not exists edge_rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);

create index if not exists edge_rate_limits_window_idx on edge_rate_limits (window_start);

alter table edge_rate_limits enable row level security;
revoke all on edge_rate_limits from anon, authenticated;

-- Records one hit for p_bucket and returns true while the bucket is still
-- within p_limit hits for the current window. Rows older than an hour are
-- pruned on the way, so the table stays small without a cron job.
create or replace function edge_rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  delete from edge_rate_limits where window_start < now() - interval '1 hour';

  insert into edge_rate_limits (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = edge_rate_limits.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke execute on function edge_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function edge_rate_limit_hit(text, integer, integer) to service_role;
