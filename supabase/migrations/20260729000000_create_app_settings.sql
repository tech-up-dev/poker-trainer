-- app_settings: a generic key/value store for runtime-configurable app behavior,
-- so values like the lesson result tiers can be changed without a code deploy.
-- First consumer: lesson_result_tiers (currently hardcoded in LessonSessionPage).
create table if not exists app_settings (
  key   text  primary key,
  value jsonb not null
);

alter table app_settings enable row level security;

-- Authenticated users (members + admins) may read settings; the app fetches these
-- with the member's session. Writes are intentionally NOT granted to any API role
-- here: settings are managed via migrations / the dashboard / a service-role edge
-- function, so members can never mutate app behavior.
create policy "app_settings_select"
  on app_settings for select
  using (auth.role() = 'authenticated');

insert into app_settings (key, value) values (
  'lesson_result_tiers',
  '[
    {"min_pct": 90, "message": "Outstanding performance!", "confetti": true},
    {"min_pct": 70, "message": "Lesson complete!", "confetti": true},
    {"min_pct": 50, "message": "Good effort, keep going!", "confetti": false},
    {"min_pct": 0,  "message": "Keep practicing", "confetti": false}
  ]'::jsonb
)
on conflict (key) do nothing;
