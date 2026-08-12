-- M3-08: snapshot the question's tags onto each answer event at answer time.
--
-- These are copied values, not references, so re-tagging a question later never
-- changes a historical row. They cannot be backfilled after the fact (the tag a
-- question had at answer time is not recoverable), which is why this lands before
-- real answer data is collected.
--
-- All nullable: existing content may not carry the M3-09 tags yet, and a given
-- question need not set every dimension.
alter table answer_events add column if not exists concept     text;
alter table answer_events add column if not exists street      text;
alter table answer_events add column if not exists player_type text;
alter table answer_events add column if not exists difficulty  text;
alter table answer_events add column if not exists platform    text;
