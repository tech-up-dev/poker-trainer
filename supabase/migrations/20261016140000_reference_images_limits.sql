-- #77 / audit F-010: the reference-images bucket accepted any file type and
-- size, and any signed-in member could upload to it.
--
-- Limit it to images up to 5 MB and restrict uploads to admins. Files that are
-- already stored are not affected.
--
-- Making the bucket private (F-009) needs the front end to render signed URLs
-- instead of the public URLs stored in reference markdown, so it is not done here.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'reference-images';

drop policy if exists "reference_images_authenticated_upload" on storage.objects;

create policy "reference_images_admin_upload" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'reference-images'
    and exists (
      select 1 from public.entitlements e
      where e.user_id = (select auth.uid())
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );
