-- M3-10 (content model spec): soft-delete for concepts.
--
-- Deleting a concept that has content tagged to it is blocked; the admin reassigns
-- its content to another concept first (the reassign-concept Edge Function), which
-- then soft-deletes it by stamping deleted_at. Soft delete (not a row removal) so
-- historical answer events, which store the concept slug, can still resolve the
-- concept name at read time.
--
-- RLS is unchanged: any authenticated user may still read every row (name
-- resolution needs the soft-deleted ones too), and only admins/service-role write.
-- Callers that want the ACTIVE vocabulary filter `deleted_at is null` at query
-- time (the authoring dropdowns and the Topic filter); analytics/name-resolution
-- read all rows.
alter table concepts add column if not exists deleted_at timestamptz;

create index if not exists concepts_active_idx on concepts (sort_order) where deleted_at is null;
