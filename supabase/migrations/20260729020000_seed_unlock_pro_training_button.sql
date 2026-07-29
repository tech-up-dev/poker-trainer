-- Seed the Upsell Button config consumed by the Pro Training upsell UI.
-- Stored in app_settings so copy / enabled can change without a deploy.
insert into app_settings (key, value) values (
  'unlock_pro_training_button',
  '{"title": "Unlock Pro Training", "subtitle": "Members save 40%", "enabled": true}'::jsonb
)
on conflict (key) do nothing;
