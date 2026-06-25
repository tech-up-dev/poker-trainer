-- Fix content_type CHECK constraint to use 'glossary' instead of 'glossary_term'.
-- The Zod content registry (shared/schemas/content.ts) uses 'glossary' as the
-- canonical type identifier; the previous migration used 'glossary_term' by mistake.
-- No data to migrate — no glossary rows exist yet.

alter table content_staging
  drop constraint content_staging_content_type_check;
alter table content_staging
  add constraint content_staging_content_type_check
  check (content_type in ('lesson', 'tip', 'reference', 'path_node', 'glossary'));

alter table content_published
  drop constraint content_published_content_type_check;
alter table content_published
  add constraint content_published_content_type_check
  check (content_type in ('lesson', 'tip', 'reference', 'path_node', 'glossary'));

alter table content_versions
  drop constraint content_versions_content_type_check;
alter table content_versions
  add constraint content_versions_content_type_check
  check (content_type in ('lesson', 'tip', 'reference', 'path_node', 'glossary'));
