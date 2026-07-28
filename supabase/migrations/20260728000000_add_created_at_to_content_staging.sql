-- content_staging previously tracked only updated_at. Add created_at so the
-- Staging browser can show when an item was first saved, not just last updated
-- (Task 34: list-from-staging now selects created_at).
--
-- New inserts get now() via the default. Existing rows have no true creation
-- time recorded, so they are backfilled from updated_at as the closest available
-- approximation (created_at is always <= updated_at).
alter table content_staging
  add column if not exists created_at timestamptz not null default now();

update content_staging set created_at = updated_at where created_at > updated_at;
