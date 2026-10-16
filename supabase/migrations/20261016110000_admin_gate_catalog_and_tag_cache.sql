-- #77 / audit F-002 + F-006.
--
-- F-002: any signed-in member could insert, edit or delete Pro Training
-- courses (e.g. point sales_url at a phishing page). Writes now need an active
-- admin_access entitlement, the same gate as content_staging / app_settings.
-- Members keep read access to the catalog.
--
-- F-006: any signed-in member could read the full GHL tag list (Steve's funnel
-- and product naming). Only the admin Pro Training page uses it, so it is
-- admin-only now.

drop policy if exists "pro_training_courses_insert" on pro_training_courses;
drop policy if exists "pro_training_courses_update" on pro_training_courses;
drop policy if exists "pro_training_courses_delete" on pro_training_courses;

create policy "pro_training_courses_admin_insert" on pro_training_courses
  for insert
  to authenticated
  with check (
    exists (
      select 1 from entitlements e
      where e.user_id = (select auth.uid())
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

create policy "pro_training_courses_admin_update" on pro_training_courses
  for update
  to authenticated
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = (select auth.uid())
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  )
  with check (
    exists (
      select 1 from entitlements e
      where e.user_id = (select auth.uid())
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

create policy "pro_training_courses_admin_delete" on pro_training_courses
  for delete
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

drop policy if exists "read ghl tags cache" on ghl_tags_cache;

create policy "ghl_tags_cache_admin_select" on ghl_tags_cache
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
