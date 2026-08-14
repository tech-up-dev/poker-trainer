-- M3-10 (content model spec): concept help text + seed the 20-concept vocabulary.
--
-- description is admin-only authoring guidance shown in the CMS concept dropdown;
-- it is never surfaced to members. Text is Steve's verbatim help text (em dashes
-- swapped for semicolons/commas, meaning unchanged). The 20 go in from day one in
-- the spec's order; the placeholder 'test' concept stays for the migration mapping.
alter table concepts add column if not exists description text;

insert into concepts (slug, name, description, sort_order) values
  ('3-betting', '3-Betting', $d$When to 3-bet, which hands to fire with, and when folding is the better play. From any position other than the blinds; a 3-bet with callers already in is Squeezing.$d$, 1),
  ('character-mapping', 'Character Mapping', $d$Identifying which of the six player types you're facing from how they've been playing. Use only when identifying the type is the question; if the question asks what to do, tag the action instead.$d$, 2),
  ('playing-3bet-pots', 'Playing 3-Bet Pots', $d$Navigating an inflated pot after a preflop 3-bet, especially as the aggressor who missed. Use only once there's a flop, and only when the difficulty comes from the pot being 3-bet.$d$, 3),
  ('c-betting', 'C-Betting', $d$Firing the flop as the preflop raiser, and when to check back instead. The first bet only; continuing on later streets is Barreling.$d$, 4),
  ('value-betting', 'Value Betting', $d$Getting maximum value from a hand that's ahead, including building the pot early so the river bet is big. Betting to make them fold is Barreling.$d$, 5),
  ('barreling', 'Barreling', $d$Continuing to fire on the turn or river when you want folds rather than calls. The first bet as preflop aggressor is C-Betting.$d$, 6),
  ('floating', 'Floating', $d$Calling a flop bet with backdoor equity and position, planning to take the pot away later. Calling to win at showdown is Bluff Catching.$d$, 7),
  ('odds-equity', 'Odds & Equity', $d$Pot odds, implied odds, fold equity and the Rule of 2 and 4; whether the price justifies the call. Small-pair set-mining calls tag here.$d$, 8),
  ('facing-3bets', 'Facing 3-Bets', $d$You opened and got raised: call, fold, or 4-bet. You raising their open is 3-Betting.$d$, 9),
  ('squeezing', 'Squeezing', $d$3-betting over a raise and one or more callers, to isolate and take the dead money. With no callers in between it's 3-Betting.$d$, 10),
  ('check-raising', 'Check-Raising', $d$The check-raise for value, as a semi-bluff, and against players who bet when checked to.$d$, 11),
  ('bet-sizing', 'Bet Sizing', $d$Matching your sizing to board texture, equity and player type. Use only when the action is already settled and the question is purely how much.$d$, 12),
  ('isolating-limpers', 'Isolating Limpers', $d$Raising over one or more limpers to get heads-up and in position against the weakest player at the table.$d$, 13),
  ('hand-reading', 'Hand Reading', $d$Narrowing what this specific opponent holds right now, from their action across streets. What type of player he is, is Character Mapping.$d$, 14),
  ('multiway-pots', 'Multiway Pots', $d$Adjusting hand selection, sizing and aggression when three or more players see the flop.$d$, 15),
  ('playing-draws', 'Playing Draws', $d$Playing flush and straight draws for equity and fold equity; semi-bluffing rather than calling passively.$d$, 16),
  ('bluff-catching', 'Bluff Catching', $d$Calling a bet with a marginal hand to win at showdown. Calling to take the pot away later is Floating.$d$, 17),
  ('blind-defense', 'Blind Defense', $d$Playing the small and big blind against an open. The same decision from any other position is 3-Betting.$d$, 18),
  ('board-texture', 'Board Texture', $d$Reading whether a board is wet or dry and which player it favours. Use only when reading the board is the question itself.$d$, 19),
  ('table-image', 'Table Image', $d$Building, cycling and cashing in the image you've projected, including how to play after getting caught bluffing.$d$, 20)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
