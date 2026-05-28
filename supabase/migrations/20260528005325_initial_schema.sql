-- Draft content. Last-write-wins per lesson_id. This is where authors save work.
create table lessons_staging (
  lesson_id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

-- Currently-live published lesson per lesson_id.
create table lessons_published (
  lesson_id text primary key,
  content jsonb not null,
  current_version_id uuid not null,
  published_at timestamptz not null default now()
);

-- Full history of every promoted version. Rollback operates here.
create table lesson_versions (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  version_number int not null,
  content jsonb not null,
  published_at timestamptz not null default now(),
  is_current boolean not null default false,
  unique (lesson_id, version_number)
);

create index on lesson_versions (lesson_id, version_number desc);
create index on lesson_versions (lesson_id, is_current) where is_current = true;

-- RLS on for safety. Permissive policies for the test scope only.
-- M1 proper tightens these with role-based admin.
alter table lessons_staging enable row level security;
alter table lessons_published enable row level security;
alter table lesson_versions enable row level security;

create policy "admin all staging" on lessons_staging for all using (true);
create policy "admin all published" on lessons_published for all using (true);
create policy "admin all versions" on lesson_versions for all using (true);
