-- Storage bucket for images embedded in reference content (body_markdown).
-- The front-end uploads via supabaseProd.storage.from('reference-images')
-- and inserts the public URL as standard markdown: ![alt](url).
insert into storage.buckets (id, name, public)
values ('reference-images', 'reference-images', true)
on conflict (id) do nothing;

-- Anyone (including unauthenticated members) can read/download images so they
-- render in the member app without requiring a session.
create policy "reference_images_public_read"
  on storage.objects for select
  using (bucket_id = 'reference-images');

-- Only authenticated users (admins) can upload images.
create policy "reference_images_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'reference-images');
