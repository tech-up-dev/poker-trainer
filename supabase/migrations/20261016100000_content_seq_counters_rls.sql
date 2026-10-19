-- #77 / audit F-005: commit the fix that was applied by hand on staging + prod
-- on 2026-09-30, so the repo matches the live databases.
--
-- The hand fix revoked the API-relevant privileges but left REFERENCES,
-- TRIGGER, TRUNCATE and MAINTAIN on anon/authenticated. PostgREST can't reach
-- those, but there's no reason to keep them, so revoke everything.
-- service_role (save-to-staging via next_content_seq()) keeps full access.
alter table content_seq_counters enable row level security;
revoke all on content_seq_counters from anon, authenticated;
