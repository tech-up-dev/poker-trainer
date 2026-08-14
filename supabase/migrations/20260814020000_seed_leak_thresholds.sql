-- M3-16 (content model spec): the leak panel's two thresholds live in admin
-- settings, not code, so Steve can tune them after launch without a ticket.
-- leak_min_attempts: minimum attempts on a concept before it can show as a leak.
-- leak_accuracy_ceiling: accuracy percent at or below which a concept counts as a
-- leak. Seeded with the spec defaults (8 and 75); editable via the settings screen.
insert into app_settings (key, value) values
  ('leak_min_attempts', '8'::jsonb),
  ('leak_accuracy_ceiling', '75'::jsonb)
on conflict (key) do nothing;
