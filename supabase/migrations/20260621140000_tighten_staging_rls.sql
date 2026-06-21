-- Lock down staging writes now that there's an admin login.
--
-- The paid-test scope left lessons_staging wide open ("admin all staging" with
-- using (true)), which was fine when the validator was a throwaway. With a real
-- login and the seeded admin in place, replace it with an admin-entitlement check
-- so only a signed-in admin can read or write staged content.
--
-- Service-role callers (the Edge Functions) bypass RLS, so promote/rollback are
-- unaffected. The signed-in admin's client carries their JWT, so the validator
-- and bulk-import keep working for them.
--
-- Depends on the entitlements table from the entitlements/auth migration.

drop policy "admin all staging" on lessons_staging;

create policy "admin all staging" on lessons_staging
  for all
  using (
    exists (
      select 1
      from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  )
  with check (
    exists (
      select 1
      from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );
