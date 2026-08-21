-- M5-03 Pro Training suppression. Never upsell a member a course they already own.
-- A member owns a course when their GHL contact carries that course's tag.

-- 1. Course -> GHL tag mapping (admin-configured). Null = the course is never
--    auto-hidden.
alter table pro_training_courses add column if not exists ghl_tag text;

-- 2. Cached list of the location's live GHL tags, for the admin's per-course tag
--    dropdown. Single row; refresh-ghl-tags replaces it. Cached so the dropdown is
--    fast and survives a GHL outage (fail-open).
create table ghl_tags_cache (
  id           boolean primary key default true check (id),
  tags         jsonb   not null default '[]'::jsonb,
  refreshed_at timestamptz not null default now()
);
insert into ghl_tags_cache (id, tags) values (true, '[]'::jsonb) on conflict (id) do nothing;

alter table ghl_tags_cache enable row level security;
create policy "read ghl tags cache"
  on ghl_tags_cache for select
  using (auth.role() = 'authenticated');

-- 3. Each member's GHL tags, synced from the ghl-webhook and ghl-resync paths
--    (they already fetch the contact's tags). Server-written; owner reads their own.
create table member_ghl_tags (
  user_id   uuid primary key references auth.users on delete cascade,
  tags      text[] not null default '{}',
  synced_at timestamptz not null default now()
);

alter table member_ghl_tags enable row level security;
create policy "read own ghl tags"
  on member_ghl_tags for select
  using (auth.uid() = user_id);

-- 4. Owned-course resolver (fail-open). Returns the enabled courses the caller
--    owns and whether they own every enabled (tagged) course. If the member's tag
--    sync is missing or stale (> 48h), ownership is unknown, so nothing is owned
--    and the FE shows all courses.
create or replace function get_owned_courses()
returns jsonb language sql security invoker stable set search_path = public, pg_temp as $$
  with me as (
    select tags
    from member_ghl_tags
    where user_id = auth.uid() and synced_at > now() - interval '48 hours'
  ),
  enabled as (
    select id, ghl_tag from pro_training_courses where enabled
  ),
  owned as (
    select e.id
    from enabled e, me
    where e.ghl_tag is not null and e.ghl_tag = any(me.tags)
  )
  select jsonb_build_object(
    'owned_course_ids', coalesce((select jsonb_agg(id) from owned), '[]'::jsonb),
    'owns_all', (select count(*) from enabled) > 0
                and (select count(*) from owned) = (select count(*) from enabled)
  );
$$;
