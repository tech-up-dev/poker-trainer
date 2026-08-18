-- M3-03: seed quiz_app_access entitlement for all existing auth users so they
-- retain access when the RequireSession entitlement gate is enforced in the app.
-- New sign-ups receive this entitlement via the handle_new_user trigger.
insert into entitlements (user_id, entitlement_key, status)
select
  id as user_id,
  'quiz_app_access' as entitlement_key,
  'active' as status
from auth.users
on conflict (user_id, entitlement_key) do nothing;
