create table if not exists pro_training_courses (
  id          uuid        primary key default gen_random_uuid(),
  eyebrow     text        not null,
  title       text        not null,
  description text        not null,
  list_price  integer     not null,
  member_price integer    not null,
  tone        text        not null default 'amber'
                          check (tone in ('amber', 'teal', 'violet', 'blue')),
  sales_url   text        not null default '#',
  sort_order  integer     not null default 0,
  enabled     boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table pro_training_courses enable row level security;

-- Anyone authenticated can read enabled courses
create policy "pro_training_courses_select"
  on pro_training_courses for select
  using (auth.role() = 'authenticated');

-- Only authenticated users (admins, gated by RequireAuth in the app) can write
create policy "pro_training_courses_insert"
  on pro_training_courses for insert
  with check (auth.role() = 'authenticated');

create policy "pro_training_courses_update"
  on pro_training_courses for update
  using (auth.role() = 'authenticated');

create policy "pro_training_courses_delete"
  on pro_training_courses for delete
  using (auth.role() = 'authenticated');

-- Seed the four default courses
insert into pro_training_courses (eyebrow, title, description, list_price, member_price, tone, sales_url, sort_order) values
  (
    '3-Betting',
    'Advanced 3-Betting Mastery',
    'Turn your pre-flop aggression into a weapon. Build balanced 3-bet ranges by position, learn when to flat vs. squeeze, and print money against players who fold too much.',
    199, 119, 'amber', '#', 1
  ),
  (
    'GTO Foundations',
    'Range Construction & GTO Foundations',
    'Stop guessing and start thinking in ranges. A plain-English walkthrough of the solver concepts that actually matter at small stakes — no math degree required.',
    249, 149, 'teal', '#', 2
  ),
  (
    'Post-Flop',
    'River Play & Big-Bet Poker',
    'The river is where the money is won and lost. Master thin value bets, well-timed bluffs, and the hero calls that separate winners from break-even grinders.',
    149, 89, 'violet', '#', 3
  ),
  (
    'Player Reads',
    'Exploiting Small-Stakes Regulars',
    'Every reg has a leak. Learn to spot the common small-stakes tendencies fast and adjust in real time to squeeze maximum value out of the players you see every session.',
    99, 59, 'blue', '#', 4
  );
