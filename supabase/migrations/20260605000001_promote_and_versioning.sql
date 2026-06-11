-- Reshape lessons_published to match the promote/versioning spec:
-- swap current_version_id (uuid) for a sequential current_version (int);
-- rename published_at -> updated_at to reflect upsert-on-promote semantics.
alter table lessons_published drop column current_version_id;
alter table lessons_published add column current_version int;
update lessons_published set current_version = 1 where current_version is null;
alter table lessons_published alter column current_version set not null;
alter table lessons_published rename column published_at to updated_at;

-- Reshape lesson_versions:
-- rename published_at -> created_at (every row is the snapshot at promote/rollback time);
-- drop is_current (lessons_published.current_version is the source of truth);
-- add created_by ("promote" or "rollback") and source_version (target of a rollback).
alter table lesson_versions rename column published_at to created_at;
alter table lesson_versions drop column is_current;
alter table lesson_versions add column created_by text;
alter table lesson_versions add column source_version int;

create index lesson_versions_lesson_id_created_at_desc_idx
  on lesson_versions (lesson_id, created_at desc);

-- Tighten RLS: writes only via service role (Edge Functions bypass RLS).
-- Anon retains read access so the versions panel in the validator UI can fetch.
drop policy "admin all published" on lessons_published;
drop policy "admin all versions" on lesson_versions;

create policy "anon read published"
  on lessons_published for select
  using (true);

create policy "anon read versions"
  on lesson_versions for select
  using (true);
