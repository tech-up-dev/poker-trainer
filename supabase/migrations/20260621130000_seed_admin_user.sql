-- Seed the bootstrap admin.
--
-- This runs as part of the migrations so a fresh environment - including a brand
-- new production project - comes up with an account that can reach the CMS
-- straight away, no manual dashboard step. The user is created with its email
-- pre-confirmed (immediate login, no email wait) and granted the admin_access
-- entitlement the CMS checks.
--
-- SECURITY: the password here is a TEMPORARY bootstrap credential and is visible
-- to anyone with repo access. Rotate it the first time you sign in on any real
-- environment (Supabase dashboard -> Authentication -> Users, or a password
-- reset once email is wired up in M3). Treat it as throwaway, not a secret.
--
-- Idempotent: if the admin already exists the user insert is skipped, and the
-- entitlement grant is a no-op on conflict. Depends on the entitlements table,
-- the user-profile trigger, and pgcrypto from the previous migration.

do $$
declare
  admin_email    text := 'admin@domain.com';
  admin_password text := 'Administrator1!';
  admin_id       uuid;
begin
  select id into admin_id from auth.users where email = admin_email;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
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
      crypt(admin_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrator"}'::jsonb
    );

    -- Supabase needs a matching identity row for email/password sign-in to work.
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
  end if;

  -- Grant CMS access. Separate from the user creation so it self-heals even if
  -- the user existed but the grant was somehow missing.
  insert into entitlements (user_id, entitlement_key, source)
  values (admin_id, 'admin_access', 'migration')
  on conflict (user_id, entitlement_key) do nothing;
end $$;
