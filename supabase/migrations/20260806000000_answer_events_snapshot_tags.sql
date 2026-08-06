-- Snapshot denormalized tags onto each answer event so historical per-concept
-- stats don't shift when a question's tags are edited in the CMS later.
--
-- All columns are nullable: events logged before this migration have no tag
-- data, and not every question has every tag populated.
alter table answer_events
  add column if not exists concept_tag    text,
  add column if not exists principle_tag  text,
  add column if not exists street         text,
  add column if not exists player_type    text,
  add column if not exists difficulty     text;

-- Per-member accuracy grouped by concept tag is the primary query for the
-- weak-spots dashboard planned in Milestone 4.
create index if not exists answer_events_user_concept_idx
  on answer_events (user_id, concept_tag);
