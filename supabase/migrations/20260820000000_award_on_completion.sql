-- M4-03 award engine: points, badges and streak roll-up on lesson/drill completion.
--
-- Implemented as a SECURITY DEFINER trigger on user_progress. The client may
-- write its own user_progress rows (its quiz activity is client-owned), but only
-- this trigger - running as the function owner, which bypasses the owner-read-only
-- RLS on the reward tables - writes points_ledger, user_badges and user_streaks.
-- So awards remain server-side: the client cannot insert points or grant itself a
-- badge directly.
--
-- Awards fire once per completion, when a progress row transitions to completed
-- (INSERT with completed = true, or UPDATE false -> true). Re-opening and
-- re-finishing a lesson does not re-award, because old.completed is already true.
--
-- Award rules (FE contract):
--   points:  lesson_complete = 10, drill_complete = 15   -> points_ledger
--   badges:  first_lesson, streak_7, streak_30, questions_100 -> user_badges
--   streak:  roll up current/longest/last_active_date + total_points -> user_streaks
--
-- NOTE: awards derive from client-written user_progress, so a determined client
-- could in principle inflate its own gamification stats. That is an accepted
-- trade-off for engagement features; harden later (compute from answer_events
-- server-side) if these ever gate anything of value.

create or replace function award_on_progress_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason  text;
  v_points  int;
  v_tz      text;
  v_today   date;
  v_prev    date;
  v_current int;
  v_longest int;
  v_totalq  int;
begin
  -- Only act on a fresh completion transition.
  if not (new.completed is true and (tg_op = 'INSERT' or old.completed is distinct from true)) then
    return new;
  end if;

  -- 1. Points for this completion (lesson = 10, drill = 15; other types earn none).
  if new.content_type = 'lesson' then
    v_reason := 'lesson_complete'; v_points := 10;
  elsif new.content_type = 'drill' then
    v_reason := 'drill_complete'; v_points := 15;
  else
    v_reason := null; v_points := 0;
  end if;

  if v_points > 0 then
    insert into points_ledger (user_id, points, reason)
    values (new.user_id, v_points, v_reason);
  end if;

  -- 2. Streak roll-up. Make sure a summary row exists, then read its state.
  insert into user_streaks (user_id) values (new.user_id)
  on conflict (user_id) do nothing;

  select timezone, last_active_date, current_streak, longest_streak
    into v_tz, v_prev, v_current, v_longest
    from user_streaks where user_id = new.user_id;

  v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  if v_prev = v_today then
    -- already active today: streak count unchanged (points still awarded below)
    v_current := coalesce(v_current, 0);
  elsif v_prev = v_today - 1 then
    v_current := coalesce(v_current, 0) + 1;
  else
    v_current := 1;
  end if;
  v_longest := greatest(coalesce(v_longest, 0), v_current);

  update user_streaks
     set current_streak   = v_current,
         longest_streak   = v_longest,
         last_active_date = v_today,
         total_points     = total_points + v_points
   where user_id = new.user_id;

  -- 3. Badges. The unique (user_id, badge_slug) constraint keeps each idempotent.
  if new.content_type = 'lesson' then
    insert into user_badges (user_id, badge_slug) values (new.user_id, 'first_lesson')
    on conflict (user_id, badge_slug) do nothing;
  end if;

  if v_current >= 7 then
    insert into user_badges (user_id, badge_slug) values (new.user_id, 'streak_7')
    on conflict (user_id, badge_slug) do nothing;
  end if;

  if v_current >= 30 then
    insert into user_badges (user_id, badge_slug) values (new.user_id, 'streak_30')
    on conflict (user_id, badge_slug) do nothing;
  end if;

  select coalesce(sum(questions_answered), 0) into v_totalq
    from user_progress where user_id = new.user_id;

  if v_totalq >= 100 then
    insert into user_badges (user_id, badge_slug) values (new.user_id, 'questions_100')
    on conflict (user_id, badge_slug) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_award_on_progress_completion on user_progress;
create trigger trg_award_on_progress_completion
  after insert or update on user_progress
  for each row execute function award_on_progress_completion();
