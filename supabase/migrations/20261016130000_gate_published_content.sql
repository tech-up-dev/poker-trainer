-- #77 / audit F-004 (Critical): content_published and content_versions were
-- readable by anyone holding the public anon key, so the whole paid library
-- could be downloaded without signing up.
--
-- content_published: members with an active quiz_app_access entitlement, and
-- admins (admin pages read it too).
-- content_versions: admins only (only the admin Versions panel reads it).
--
-- Edge Functions read both with the service role, which bypasses RLS.

drop policy if exists "anon read content_published" on content_published;
drop policy if exists "anon read content_versions" on content_versions;

create policy "entitled read content_published" on content_published
  for select
  to authenticated
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = (select auth.uid())
        and e.entitlement_key in ('quiz_app_access', 'admin_access')
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

create policy "admin read content_versions" on content_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = (select auth.uid())
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );
