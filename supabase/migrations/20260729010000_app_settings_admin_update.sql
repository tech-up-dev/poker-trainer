-- Let signed-in admins update app settings from the admin Settings page (the
-- Save button). Read stays open to any authenticated user (added when the table
-- was created); insert/delete remain migration / service-role managed, so new
-- setting keys are still a deliberate schema concern, not user-writable.
--
-- Admin check mirrors the entitlement pattern used by content_staging: an active,
-- non-expired 'admin_access' entitlement for the calling user. Service-role
-- callers (Edge Functions) bypass RLS as usual.
create policy "app_settings_admin_update" on app_settings
  for update
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  )
  with check (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );
