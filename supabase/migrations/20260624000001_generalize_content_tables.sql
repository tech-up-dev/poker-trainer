-- Generalize the content pipeline from lesson-specific tables to
-- content-type-agnostic ones. Lessons, Tips, References, Path Nodes, and
-- Glossary Terms all flow through the same three tables, distinguished by
-- the content_type column.
--
-- Old tables:  lessons_staging · lessons_published · lesson_versions
-- New tables:  content_staging · content_published · content_versions
--
-- Existing lesson rows are migrated with content_type = 'lesson'.
-- Old tables are dropped after migration.

-- ============================================================
-- 1. Create new tables
-- ============================================================

create table content_staging (
  content_id   text        not null,
  content_type text        not null check (content_type in ('lesson', 'tip', 'reference', 'path_node', 'glossary_term')),
  content      jsonb       not null,
  updated_at   timestamptz not null default now(),
  primary key (content_id, content_type)
);

create table content_published (
  content_id      text        not null,
  content_type    text        not null check (content_type in ('lesson', 'tip', 'reference', 'path_node', 'glossary_term')),
  content         jsonb       not null,
  current_version int         not null,
  updated_at      timestamptz not null default now(),
  primary key (content_id, content_type)
);

create table content_versions (
  id             uuid        primary key default gen_random_uuid(),
  content_id     text        not null,
  content_type   text        not null check (content_type in ('lesson', 'tip', 'reference', 'path_node', 'glossary_term')),
  version_number int         not null,
  content        jsonb       not null,
  created_by     text,
  source_version int,
  created_at     timestamptz not null default now(),
  unique (content_id, content_type, version_number)
);

create index content_versions_lookup_idx
  on content_versions (content_id, content_type, version_number desc);

create index content_versions_created_at_idx
  on content_versions (content_id, content_type, created_at desc);

-- ============================================================
-- 2. Migrate existing lesson data
-- ============================================================

insert into content_staging (content_id, content_type, content, updated_at)
select lesson_id, 'lesson', content, updated_at
from lessons_staging;

insert into content_published (content_id, content_type, content, current_version, updated_at)
select lesson_id, 'lesson', content, current_version, updated_at
from lessons_published;

insert into content_versions (id, content_id, content_type, version_number, content, created_by, source_version, created_at)
select id, lesson_id, 'lesson', version_number, content, created_by, source_version, created_at
from lesson_versions;

-- ============================================================
-- 3. RLS
-- ============================================================

alter table content_staging  enable row level security;
alter table content_published enable row level security;
alter table content_versions  enable row level security;

-- Staging: only signed-in admins (service role bypasses RLS for Edge Functions).
create policy "admin all content_staging" on content_staging
  for all
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  )
  with check (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

-- Published + versions: public read (members read live content).
create policy "anon read content_published" on content_published
  for select using (true);

create policy "anon read content_versions" on content_versions
  for select using (true);

-- ============================================================
-- 4. Drop old tables
-- ============================================================

drop table lesson_versions;
drop table lessons_published;
drop table lessons_staging;
