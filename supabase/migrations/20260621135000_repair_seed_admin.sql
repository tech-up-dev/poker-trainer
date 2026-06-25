-- Repair the bootstrap admin created by 20260621130000.
-- The original seed omitted required GoTrue fields (confirmation_token,
-- recovery_token, is_sso_user, etc.) causing "Database error querying schema"
-- on sign-in. This migration deletes the incomplete user and recreates it
-- with all required fields explicitly set.
-- Idempotent: safe to run on environments that never had the broken user.

do $$
declare
  admin_email    text := 'admin@domain.com';
  admin_password text := 'Administrator1!';
  admin_id       uuid;
begin
  -- Remove the incomplete user so we can recreate cleanly.
  -- Cascade handles user_profiles via the FK; identities must be deleted first.
  delete from auth.identities where provider = 'email' and provider_id = admin_email;
  delete from auth.users where email = admin_email;

  admin_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    is_sso_user,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000',
    admin_id,
    'authenticated',
    'authenticated',
    admin_email,
    extensions.crypt(admin_password, extensions.gen_salt('bf', 10)),
    now(),
    '',
    '',
    '',
    '',
    false,
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Administrator"}'::jsonb
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    admin_id,
    jsonb_build_object('sub', admin_id::text, 'email', admin_email),
    'email',
    admin_email,
    now(),
    now(),
    now()
  );

  insert into entitlements (user_id, entitlement_key, source)
  values (admin_id, 'admin_access', 'migration')
  on conflict (user_id, entitlement_key) do nothing;
end $$;
