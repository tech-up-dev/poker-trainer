-- #73 / #75: two admin-editable app_settings keys.
--
-- Both rows are seeded here because app_settings_admin_update only allows
-- UPDATE; insert stays migration-managed, so the admin page needs the row to
-- exist before it can save.
--
-- #73 reference_category_order: section order on the References page
-- (values match the category enum in shared/schemas/reference.ts).
insert into app_settings (key, value)
values ('reference_category_order', '["cheat_sheet","character_mapping","methodology"]'::jsonb)
on conflict (key) do nothing;

-- #75 tracking_config: Meta Pixel ID / Hyros snippet, entered by the admin.
-- Empty until Steve provides the values; the FE defines the object shape.
insert into app_settings (key, value)
values ('tracking_config', '{}'::jsonb)
on conflict (key) do nothing;

-- The login and subscribe pages load tracking while signed out, so anon may
-- read this ONE key. Every other app_settings row stays authenticated-only.
create policy "app_settings_anon_select_tracking"
  on app_settings for select
  to anon
  using (key = 'tracking_config');
