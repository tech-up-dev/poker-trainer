-- M3-15: sequential content numbering.
--
-- Every content item (lesson, tip, reference, glossary, path_node) gets an
-- automatic per-type sequence number, assigned once in save-to-staging and then
-- carried unchanged through promote into content_published / content_versions.
-- Numbers are permanent and never reused: a deleted item just leaves a gap,
-- because allocation only ever moves a per-type counter forward.
--
-- The number is stored as a dedicated column (not inside the content JSONB) so it
-- stays out of the author-facing Zod schemas and is directly queryable/searchable
-- in the admin list views.
--
-- Backfill of existing rows is done by a one-off script (not here): staging and
-- production are separate databases, and the same content_id must receive the
-- same number in both, which a per-database migration cannot coordinate.

alter table content_staging   add column if not exists seq int;
alter table content_published add column if not exists seq int;
alter table content_versions  add column if not exists seq int;

-- Per-type monotonic counter. Only save-to-staging (staging DB, service role)
-- ever advances it; production stores whatever number it is handed on promote.
create table if not exists content_seq_counters (
  content_type text primary key,
  last_seq     int  not null default 0
);

-- Atomically allocate the next number for a type and return it. The upsert makes
-- the read-increment-write a single statement, so concurrent saves can't collide.
create or replace function next_content_seq(p_content_type text)
returns int
language plpgsql
as $$
declare
  v int;
begin
  insert into content_seq_counters (content_type, last_seq)
    values (p_content_type, 1)
  on conflict (content_type)
    do update set last_seq = content_seq_counters.last_seq + 1
  returning last_seq into v;
  return v;
end;
$$;
