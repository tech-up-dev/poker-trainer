# Poker Trainer — Lesson Content Schema Specification

This document is the canonical schema for **Poker Trainer** lesson content.
It defines the exact JSON shape every lesson must conform to before it can be
imported into the CMS, promoted to staging, and published to production.

It is written for the founder of Poker Trainer, who generates lesson content in
bulk with Claude (or another LLM). The intended workflow is:

1. Paste this entire document into a Claude chat.
2. Add a prompt at the end asking for a batch of lessons, questions, or hand
   scenarios.
3. Take Claude's JSON output and paste it into the validator UI in the CMS.
4. The validator runs the same Zod schema this document describes. Every error
   you see in the UI corresponds one-to-one with a rule listed in the
   "Validation rules summary" section below.
5. Once the validator is green, the row is in `lessons_staging`. From there it
   can be promoted to production through the same UI.

The validator is the ground truth. If anything in this document drifts from the
validator's behavior, the validator wins. Open the validator (the "Lesson
Validator" tool in the CMS), load a sample, and the green or red panel will
tell you what is actually accepted.

Field names use `snake_case` end-to-end (JSON, database columns, API payloads)
so that no transformation layer is needed between the bulk-import file and the
database row.

---

## How to use this document with Claude

The intended pattern is: paste this file into a fresh Claude conversation,
then send one of the prompt templates below. Edit the templates to suit the
batch you need.

A few rules of thumb that hold across every template:

- **Always paste the entire schema document above your prompt.** Claude needs
  the field reference, examples, and validation rules to produce JSON that
  passes. A summary will not be enough; missing fields are the single most
  common cause of rejected output.
- **End your prompt with "Output only the JSON. No commentary, no markdown
  fences, no explanation before or after."** Without this, Claude usually wraps
  the JSON in prose or triple-backtick fences, which the validator UI does not
  strip.
- **Validate immediately.** Paste Claude's output into the validator. Each
  error has a field path like `question 3, answers` or
  `question 1, table_state, street` — feed those paths back to Claude if you
  need a fix ("Re-do question 3 with exactly 4 answers").

### Template 1: a small batch of multiple-choice questions

```
Using the schema above, generate 10 multiple_choice questions on pre-flop
opening ranges from UTG in 9-max live cash. Each question should test a
different aspect of UTG play (opening hand selection, position-aware sizing,
response to 3-bets, isolating limpers, etc.). Use varied villain player types
from this set: OMC, PLF, Y2K, GTO, DWM, STP.

Each question must:
- have a unique question_id
- have a prompt that is one or two sentences
- have exactly 4 answers
- have exactly 1 answer marked is_correct: true
- have a teaching-quality explanation on every answer (right and wrong)
- include relevant glossary_terms

Output a JSON array of question objects matching the QuestionSchema. No
markdown fences, no commentary before or after the array.
```

### Template 2: a hand-scenario batch

```
Using the schema above, generate 5 hand_scenario questions on flop play out of
position with top pair. For every question, populate table_state fully:

- street: "flop"
- hero_position (vary across BB, SB, UTG, MP)
- hero_hole_cards (two cards as "As", "Kh", etc; T for ten)
- board_cards (exactly 3 cards on the flop)
- pot_size (in dollars, $1/$2 live cash, realistic post-3bet or post-raise pot)
- stack_sizes (object with at least hero and the active villain; 100bb to 200bb)
- villain_player_types (object mapping the active villain's position to a
  player type identifier from: OMC, PLF, Y2K, GTO, DWM, STP)
- seat_actions (object mapping each acting position to { action, amount? };
  action is one of Fold, Check, Limp, Call, Bet, Raise, 3-bet, 4-bet, All-in;
  include amount for Bet/Raise/Call/All-in, omit it for Fold/Check)

Every answer needs a teaching-quality explanation. Include glossary_terms for
any term a recreational player might want defined (c-bet, overpair, draw,
combo draw, etc.).

Output a JSON array of question objects only. No commentary, no markdown
fences.
```

### Template 3: a complete lesson

```
Using the schema above, generate one complete Lesson object on the topic of
c-bet sizing on dry boards.

Top-level fields:
- lesson_id: kebab-case, descriptive, like "cbet-sizing-dry-boards"
- title: a clear human-readable title
- principle_tag: pick the closest match from the five core principles
- concept: "cbet_sizing_dry_boards"
- difficulty: "intermediate"

Questions: exactly 10, mixed as follows:
- 6 multiple_choice
- 4 hand_scenario (vary the street across flop and turn; populate table_state
  fully each time, including seat_actions for each acting position using the
  vocabulary Fold/Check/Limp/Call/Bet/Raise/3-bet/4-bet/All-in)

For every question: unique question_id, one- or two-sentence prompt, exactly 4
answers, exactly 1 is_correct: true, teaching-quality explanation on every
answer, and glossary_terms where appropriate.

Output a single Lesson object as JSON. No commentary, no markdown fences.
```

After Claude generates the JSON, paste it into the validator UI. The validator
runs the schema described in the rest of this document. Any rejection comes
with a specific field path and a plain-language message you can re-prompt
Claude with.

---

## Bulk import formats: JSON, CSV, Markdown

The Bulk Import screen accepts three input formats. All three convert to the
same objects and run through the same validator, so every rejection reports the
same field path and message regardless of format.

- **JSON** (paste or `.json` file): an array of items, a single item, or a
  one-key wrapper such as `{ "glossary": [ ... ] }`. Each item's content type is
  auto-detected. This is the canonical format; CSV and Markdown are conveniences
  that produce the same objects.

### CSV (`.csv`) - tabular content

Best for the flat content types (glossary, tip, reference). One header row of
field names, then one item per row. Rules:

- Header names must match the schema field names exactly (`term`, `definition`,
  `importance`, `body`, `title`, `category`, `reference_id`, etc.).
- List-valued columns (`tags`, `related_terms`) hold a `|`-separated list, e.g.
  `equity|implied-odds`. Commas are reserved for CSV cells; use `|` inside a cell.
- Wrap any cell that contains a comma or newline in double quotes; escape a
  literal quote by doubling it (`""`).
- Empty cells are skipped, so optional fields stay unset. Ids may be omitted and
  are generated on save.
- Each row is auto-detected by content type, so a single CSV should hold one
  type (all glossary rows, or all tips, etc.).

Glossary example:

```csv
term,definition,importance,related_terms
Pot Odds,"The ratio of pot size to call cost, used to gauge whether a call is profitable.",core,equity|implied-odds
c-bet,A continuation bet by the preflop raiser on the flop.,useful,
```

Lessons are not supported via CSV (they are nested); use JSON or Markdown.

### Markdown (`.md`) - prose-authored lessons

For writing a single lesson as prose. Produces one `lesson` with
`multiple_choice` questions (hand scenarios need the table builder or JSON).
Structure:

- `# Title` on the first heading line becomes the lesson `title`.
- Metadata lines before the first question, as `- key: value`, set the top-level
  fields: `principle_tag`, `concept`, `difficulty` (and optionally `lesson_id`).
- Each question starts with `## Q: <prompt>`.
- Answers are list items `- [ ] text :: explanation` (wrong) or
  `- [x] text :: explanation` (correct). Exactly 4 answers, exactly one `[x]`.
  The part before `::` is the answer text, the part after is its explanation.
- An optional `> glossary: term one, term two` line under a question sets its
  `glossary_terms`.
- `question_id` values are generated automatically (`q1`, `q2`, ...).

Example:

```markdown
# C-bet sizing on dry boards
- principle_tag: character_mapping
- concept: cbet_sizing_dry_boards
- difficulty: intermediate

## Q: On a K-7-2 rainbow flop as the preflop raiser vs one caller, what c-bet size?
- [x] Small (25-33% pot) :: Dry boards favor the aggressor; a small bet denies equity cheaply.
- [ ] Large (75% pot) :: Overbetting a dry board bloats the pot without needing protection.
- [ ] Check :: Checking surrenders the range and initiative advantage.
- [ ] All-in :: Wildly over-sized; folds out worse hands and only continues against better.
> glossary: c-bet, dry board
```

---

## Top-level Lesson schema

A Lesson is a JSON object with the following top-level fields.

| Field           | Type       | Required | Notes                                                                                         |
| --------------- | ---------- | -------- | --------------------------------------------------------------------------------------------- |
| `lesson_id`     | string     | yes      | Non-empty. Stable unique identifier. Lowercase, hyphen-separated, descriptive.                |
| `title`         | string     | yes      | Non-empty. Human-readable title shown in the app.                                             |
| `principle_tag` | string     | yes      | Non-empty. One of the five core teaching principles (see below).                              |
| `concept`       | string     | yes      | Non-empty. The specific poker concept the lesson teaches.                                     |
| `difficulty`    | enum       | no       | One of `"beginner"`, `"intermediate"`, `"advanced"`.                                          |
| `questions`     | Question[] | yes      | At least one question. Each must match the QuestionSchema (multiple_choice or hand_scenario). |

### `lesson_id`

A short, stable identifier for the lesson. Convention: lowercase letters,
digits, and hyphens. No spaces, no underscores in the user-facing identifier.

Examples:

- `"preflop-opens-utg-vs-3bet"`
- `"cbet-sizing-dry-boards"`
- `"river-bluff-blockers"`
- `"3bet-defense-bb-vs-btn"`

The validator requires it to be non-empty; the convention above is for
readability and grep-ability.

### `title`

The human-readable title shown above the lesson in the app. Aim for under 60
characters. Capitalize the first word and proper nouns; everything else is
lowercase ("Pre-flop opens from UTG vs. 3-bets").

Examples:

- `"Pre-flop Opens from UTG vs. 3-bets"`
- `"C-bet Sizing on Dry Boards"`
- `"River Bluff Blockers"`
- `"3-bet Defense from the Big Blind vs. the Button"`

### `principle_tag`

One of the five core teaching principles of the Controlled Chaos system.
**This is a closed set** — these five values are the canonical list. When
generating lessons, ask Claude explicitly for variety across principles, and
pick the one that most directly maps to the lesson's intent.

The five principles, in snake_case identifier form:

- `"character_mapping"` — reading player types and exploiting their tendencies
- `"strategic_3_betting"` — when, why, and how to 3-bet (sizing, ranges, light vs value)
- `"simple_math_for_big_stacks"` — equity, pot odds, implied odds, SPR-aware math
- `"floating_and_equity_flow"` — postflop float strategy and how equity moves between streets
- `"building_and_winning_huge_pots"` — constructing and capturing the pots that matter

The validator only requires `principle_tag` to be a non-empty string. The
five-value closed list above is enforced editorially. If a lesson does not
map cleanly to one principle, pick the closest fit and note the gap in the
PR description so the taxonomy can be revisited.

### `concept`

The specific poker concept this lesson teaches. Think of `principle_tag` as
the broad teaching frame and `concept` as the narrow topic. A single principle
can power many concepts.

**Concepts are an open, editable taxonomy.** Unlike `principle_tag` and
player-type codes, the concept list grows as the founder authors content. New
concepts are added through the CMS at author time, not by editing this doc.
Use a snake_case identifier derived from the concept's display name.

Seed concepts (the founder will extend this list over time):

- `"3bet_sizing"` — 3-Bet Sizing
- `"core_34"` — Core 34
- `"3betting_light"` — 3-Betting Light
- `"value_3betting"` — Value 3-Betting
- `"isolating_limpers"` — Isolating Limpers
- `"building_table_image"` — Building Table Image
- `"character_mapping"` — Character Mapping
- `"implied_odds"` — Implied Odds
- `"pot_odds"` — Pot Odds
- `"equity_flow"` — Equity Flow
- `"floating"` — Floating
- `"hand_reading"` — Hand Reading
- `"value_betting"` — Value Betting
- `"bet_sizing"` — Bet Sizing
- `"pot_control"` — Pot Control
- `"blockers"` — Blockers
- `"in_position"` — In Position
- `"out_of_position"` — Out of Position
- `"spr"` — Stack to Pot Ratio (SPR)
- `"continuation_betting"` — Continuation Betting
- `"table_image"` — Table Image

Convention: snake_case, lowercase, descriptive, no spaces, hyphens dropped
(so "3-Bet Sizing" becomes `"3bet_sizing"`, not `"3-bet_sizing"`).

### Closed sets vs. open taxonomies

A quick rule the validator does not enforce but content authoring depends on:

| Field                                       | Set type   | Rule                                                                                                         |
| ------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `principle_tag`                             | **Closed** | One of the five values listed above. New principles require a doc + schema update.                           |
| player-type codes in `villain_player_types` | **Closed** | One of the six codes listed in the HandScenarioState section below. New codes require a doc update.          |
| `action` in `seat_actions`                  | **Closed** | One of the nine actions listed in the HandScenarioState section below. Enforced by the validator.           |
| `concept`                                   | **Open**   | Any snake_case identifier the author chooses. New concepts are added through the CMS as content is authored. |
| `difficulty`                                | **Closed** | One of `"beginner"`, `"intermediate"`, `"advanced"`. Enforced by the validator.                              |

### `difficulty`

Optional. One of `"beginner"`, `"intermediate"`, `"advanced"`. Used by the app
to gate or order lessons in a learning path. When omitted, the app treats the
lesson as unranked.

### `questions`

An array of one or more questions. Each question is either a
`multiple_choice` or a `hand_scenario`, distinguished by the `type` field. See
the next section for the shape of each.

### Top-level example

```json
{
  "lesson_id": "preflop-opens-utg-9max",
  "title": "Pre-flop Opens from UTG (9-max)",
  "principle_tag": "character_mapping",
  "concept": "opening_ranges_utg",
  "difficulty": "intermediate",
  "questions": [/* one or more Question objects, see next section */]
}
```

---

## Question types

Every question, regardless of type, shares the following fields.

| Field            | Type     | Required | Notes                                                                                         |
| ---------------- | -------- | -------- | --------------------------------------------------------------------------------------------- |
| `question_id`    | string   | yes      | Non-empty. Unique within the lesson.                                                          |
| `type`           | enum     | yes      | Exactly `"multiple_choice"` or `"hand_scenario"`. This is the discriminator.                  |
| `prompt`         | string   | yes      | Non-empty. The question text shown to the member.                                             |
| `answers`        | Answer[] | yes      | Exactly four AnswerSchema objects, exactly one with `is_correct: true`.                       |
| `glossary_terms` | string[] | no       | Terms in the prompt or explanations that should render as tappable glossary links in the app. |

`hand_scenario` questions additionally require `table_state` (see the
HandScenarioState subschema). `multiple_choice` questions do not use
`table_state`.

### `multiple_choice`

The standard four-option question. No additional fields beyond the shared
ones. Use this for any concept that can be assessed with a single discrete
right answer.

```json
{
  "question_id": "utg-q2-sizing",
  "type": "multiple_choice",
  "prompt": "Standard UTG open sizing in a 9-max live $1/$2 game with deep stacks. What is the most theoretically sound raise size?",
  "answers": [
    {
      "text": "2x the big blind",
      "is_correct": false,
      "explanation": "2x is too small for a live game with many players behind and a high rake. It invites calls and reduces fold equity."
    },
    {
      "text": "3x the big blind",
      "is_correct": true,
      "explanation": "3x ($6 over a $2 BB) is the standard live-cash UTG open. Big enough to thin the field and price out speculative hands, small enough to keep risk manageable."
    },
    {
      "text": "5x the big blind",
      "is_correct": false,
      "explanation": "5x is over-sized and bleeds chips when called by stronger hands. Reserve larger sizes for spots with limpers or specific exploitative reads."
    },
    {
      "text": "Limp",
      "is_correct": false,
      "explanation": "Limping UTG caps your range and gives up the initiative. It's almost always a leak in 9-max cash with no prior action."
    }
  ],
  "glossary_terms": ["raise sizing", "fold equity"]
}
```

### `hand_scenario`

Same shared fields as `multiple_choice`, plus a required `table_state` object
describing the situation at the table (street, hero's position, hole cards if
relevant, the board, the pot, the relevant stack sizes, and any villain
context). See the HandScenarioState subschema for the full shape.

```json
{
  "question_id": "utg-q3-flop-decision",
  "type": "hand_scenario",
  "prompt": "You open AKs from UTG to $6 and only the BB calls. Flop comes Kc 7d 2s. BB checks. What is the most theoretically sound action?",
  "answers": [
    {
      "text": "Check back",
      "is_correct": false,
      "explanation": "Checking back forfeits value with top pair top kicker on a dry board. You lose protection and don't get paid by worse Kx and pocket pairs."
    },
    {
      "text": "C-bet small (1/3 pot)",
      "is_correct": true,
      "explanation": "A small c-bet (~$4 into $13) maximizes EV: gets thin value from worse Kx and pocket pairs, denies equity to villain's gutshots and overcards, and keeps villain's bluff-catching range wide."
    },
    {
      "text": "C-bet large (3/4 pot)",
      "is_correct": false,
      "explanation": "A large c-bet on a dry board folds out the exact hands you want to call (Qx, Jx, small pairs) and only gets called by hands that beat you or have equity against you."
    },
    {
      "text": "Overbet for protection",
      "is_correct": false,
      "explanation": "Overbetting AK on K72 rainbow is a clear leak. The board is too dry to need protection sizing, and villain folds out almost every worse hand."
    }
  ],
  "table_state": {
    "street": "flop",
    "hero_position": "UTG",
    "hero_hole_cards": ["As", "Ks"],
    "board_cards": ["Kc", "7d", "2s"],
    "pot_size": 13,
    "stack_sizes": {
      "UTG": 194,
      "BB": 194
    },
    "villain_player_types": {
      "BB": "PLF"
    },
    "seat_actions": {
      "UTG": { "action": "Raise", "amount": 6 },
      "BB": { "action": "Call", "amount": 4 }
    },
    "notes": "Villain has been calling wide preflop and folding turn often when missed."
  },
  "glossary_terms": ["c-bet", "top pair", "dry board", "protection"]
}
```

---

## Subschemas

### AnswerSchema

Every entry in `answers[]` is an object with the following fields.

| Field         | Type    | Required | Notes                                                                      |
| ------------- | ------- | -------- | -------------------------------------------------------------------------- |
| `text`        | string  | yes      | Non-empty. The answer choice shown to the member.                          |
| `is_correct`  | boolean | yes      | Exactly one answer per question must be `true`.                            |
| `explanation` | string  | yes      | Non-empty. Teaching commentary shown after the member selects this answer. |

**Treat `explanation` as the most important field for content quality.**
Every answer, right or wrong, gets a teaching-quality explanation. The
member learns more from a clear "this is why this answer is wrong" than from
the bare-correct answer alone.

Style guidance for `explanation`:

- Plain language a recreational player understands.
- One or two sentences.
- Reference the specific situation in the prompt where possible (don't write a
  generic poker truism).
- For wrong answers, explain the leak — what specifically goes wrong if you
  pick this line.
- For the right answer, explain the EV mechanism — why this line wins money
  on average against villain's range.

Example AnswerSchema object:

```json
{
  "text": "C-bet small (1/3 pot)",
  "is_correct": true,
  "explanation": "A small c-bet (~$4 into $13) maximizes EV: gets thin value from worse Kx and pocket pairs, denies equity to villain's gutshots and overcards, and keeps villain's bluff-catching range wide."
}
```

### HandScenarioState

The table context for a `hand_scenario` question. Required on every
`hand_scenario`; not used on `multiple_choice`.

| Field                  | Type                     | Required | Notes                                                                  |
| ---------------------- | ------------------------ | -------- | ---------------------------------------------------------------------- |
| `street`               | enum                     | yes      | One of `"preflop"`, `"flop"`, `"turn"`, `"river"`.                     |
| `hero_position`        | string                   | yes      | Non-empty. Standard poker position abbreviation.                       |
| `hero_hole_cards`      | string[]                 | no       | Two cards as `"As"`, `"Kh"`, etc.                                      |
| `board_cards`          | string[]                 | no       | Community cards. 0 preflop, 3 flop, 4 turn, 5 river.                   |
| `pot_size`             | number (>= 0)            | no       | Pot size in dollars or big blinds. Be consistent within a lesson.      |
| `stack_sizes`          | Record\<string, number\> | no       | Map of position string to remaining stack.                             |
| `villain_player_types` | Record\<string, string\> | no       | Map of position string to player type identifier.                      |
| `seat_actions`         | Record\<string, SeatAction\> | no   | Map of position string to that seat's action this street. See below.   |
| `notes`                | string                   | no       | Any contextual notes ("3-handed", "history of LAG play from villain"). |

#### Card notation

Two characters per card: rank, then suit.

- Ranks: `2` through `9`, `T` for ten, `J` for jack, `Q` for queen, `K` for king, `A` for ace.
- Suits: `s` (spades), `h` (hearts), `d` (diamonds), `c` (clubs).

Examples: `"As"` (ace of spades), `"Kh"` (king of hearts), `"Td"` (ten of
diamonds), `"7c"` (seven of clubs).

Hero hole cards always have two entries. Board cards depend on the street:

- `"preflop"`: zero board cards (or omit `board_cards` entirely)
- `"flop"`: three board cards
- `"turn"`: four board cards
- `"river"`: five board cards

The schema does not enforce these counts; treat them as editorial conventions
the content writer is responsible for.

#### Position strings

Standard poker position abbreviations. The schema treats `hero_position` as a
free-form non-empty string; the editorial convention for the V1 content set is:

- 9-max table: `"UTG"`, `"UTG+1"`, `"MP"`, `"LJ"`, `"HJ"`, `"CO"`, `"BTN"`, `"SB"`, `"BB"`
- 6-max table: `"UTG"`, `"MP"`, `"CO"`, `"BTN"`, `"SB"`, `"BB"`

Use the same position strings consistently as keys in `stack_sizes` and
`villain_player_types`.

#### `pot_size`

A non-negative number. Editorial convention: dollars for live-cash lessons,
big blinds for online or tournament lessons. Be consistent within a single
lesson; do not mix units across questions in the same lesson.

#### `stack_sizes`

An optional map from position string to remaining stack as a number. The unit
matches `pot_size`. Include at least hero and any villain who has a meaningful
decision to make. Skip seats that have already folded if it keeps the example
tighter; include them if the read on them is part of the scenario.

```json
{
  "UTG": 194,
  "BTN": 217,
  "BB": 188
}
```

#### `villain_player_types`

An optional map from position string to a player type code. **This is a
closed set** — the six codes below are the canonical identifiers for the
Character Mapping system. Use the uppercase code as the value.

The six Character Mapping player types:

- `"OMC"` — Old Man Coffee: traditional, passive, tight; only bets with strong hands; folds to pressure
- `"PLF"` — Passive Loose Fish: plays many hands preflop, plays them passively postflop; calls down with marginal showdown value
- `"Y2K"` — Y2K Tag: early-2000s tight-aggressive style; solid by old standards but predictable; can be exploited with modern lines
- `"GTO"` — GTO Boy: plays balanced, theory-driven ranges; hard to exploit, but predictable in unbalanced spots
- `"DWM"` — Drunk Whale Maniac: aggressive recreational; plays too many hands, bets too much, doesn't fold; value-bet thin
- `"STP"` — Smart Thinking Player: strong adaptive opponent; balanced ranges, reads hand histories, exploits population leaks

If hero is the only character in the scenario (a pure decision question with
no villain read), omit `villain_player_types` entirely.

#### `seat_actions`

An optional map from position string to the action that seat took on this
street. Optional and additive: existing lessons without `seat_actions` stay
valid. Each value is a `SeatAction` object:

| Field    | Type          | Required | Notes                                                                   |
| -------- | ------------- | -------- | ----------------------------------------------------------------------- |
| `action` | enum          | yes      | One of the closed action set below.                                     |
| `amount` | number (>= 0) | no       | Chips/dollars put in for Bet/Raise/Call/All-in; omit for Fold/Check.    |

Action vocabulary (**closed set**): `"Fold"`, `"Check"`, `"Limp"`, `"Call"`,
`"Bet"`, `"Raise"`, `"3-bet"`, `"4-bet"`, `"All-in"`.

Use the same position strings as keys here as in `stack_sizes` and
`villain_player_types`.

```json
{
  "UTG": { "action": "Raise", "amount": 6 },
  "CO": { "action": "3-bet", "amount": 18 },
  "BB": { "action": "Fold" }
}
```

#### `notes`

Optional free-form text for anything that affects the decision but does not
fit a structured field. Examples:

- `"Late-night session, table has been very passive"`
- `"Villain just lost a big pot, likely on tilt"`
- `"Hero deep-stacked vs. shallow villain (effective is 50bb)"`
- `"3-handed, deep stacks, history of LAG play from BTN"`

Keep `notes` short. If something is important enough to need a paragraph,
work it into `prompt`.

### Glossary references

Each question can include a `glossary_terms` array. Each entry is a string
matching a term defined in the app's glossary (managed separately in the CMS;
not part of this content schema). When rendered, the app makes any occurrence
of a glossary term in the prompt or explanations into a tappable link that
shows the definition.

`glossary_terms` is the explicit allow-list — the app does not auto-link.
List every term in the question that a recreational player might want a
definition for, even common ones like `"c-bet"` or `"3-bet"`.

Examples:

- `["c-bet", "top pair", "dry board"]`
- `["UTG", "opening range", "dominated"]`
- `["3-bet", "isolation raise", "effective stack"]`

If you do not include a term in this array, the app will not link to its
glossary entry even if the term appears in the prompt.

---

## Validation rules summary

The validator enforces every rule in this list. Each bullet maps to a specific
Zod check in `shared/schemas/lesson.ts`. When a rule fails, the validator UI
shows the field path and the message verbatim.

**Lesson-level**

- `lesson_id` must be present and a non-empty string.
- `title` must be present and a non-empty string.
- `principle_tag` must be present and a non-empty string.
- `concept` must be present and a non-empty string.
- `difficulty`, if present, must be one of `"beginner"`, `"intermediate"`, `"advanced"`.
- `questions` must be present and have at least one question.

**Question-level (applies to every question regardless of type)**

- `question_id` must be present and a non-empty string.
- `type` must be exactly `"multiple_choice"` or `"hand_scenario"`. Any other
  value (including `"multichoice"`, `"mcq"`, `"scenario"`, etc.) is rejected.
- `prompt` must be present and a non-empty string.
- `answers` must be present and contain exactly four entries.
- Exactly one of the four answers must have `is_correct: true`.

**Answer-level**

- `text` must be present and a non-empty string.
- `is_correct` must be present and a boolean.
- `explanation` must be present and a non-empty string.

**Hand-scenario specific**

- `table_state` is required when `type === "hand_scenario"`.
- Inside `table_state`:
  - `street` must be exactly one of `"preflop"`, `"flop"`, `"turn"`, `"river"`.
  - `hero_position` must be present and a non-empty string.
  - `pot_size`, if present, must be a number greater than or equal to zero.
  - `hero_hole_cards`, `board_cards`, `stack_sizes`,
    `villain_player_types`, and `notes` are optional; the schema does not
    enforce specific shapes beyond their declared types (string[],
    Record<string, number>, etc.).

**Multiple-choice specific**

- `multiple_choice` questions ignore `table_state` if present. The schema
  does not reject extra fields, so leaving `table_state` on an MCQ is harmless,
  but the convention is to omit it.

**Things the validator does NOT enforce**

- The exact list of valid `principle_tag` values.
- The exact list of valid `concept` values.
- The format of card strings (`"As"`, `"Kh"`, etc.).
- The number of `board_cards` for a given `street`.
- That `hero_position` is one of the canonical poker positions.
- That `stack_sizes` and `villain_player_types` use position keys consistent
  with `hero_position`.

These conventions are editorial. The content writer is responsible for them;
the validator catches structural mistakes.

---

## Complete example lesson

A single fully valid lesson. This is the canonical reference Claude should
pattern-match against when generating new content.

```json
{
  "lesson_id": "cbet-sizing-dry-boards",
  "title": "C-bet Sizing on Dry Boards",
  "principle_tag": "simple_math_for_big_stacks",
  "concept": "continuation_betting",
  "difficulty": "intermediate",
  "questions": [
    {
      "question_id": "cbet-q1-dry-vs-wet",
      "type": "multiple_choice",
      "prompt": "Which flop texture most strongly favors a small c-bet sizing (about 1/3 pot) over a larger sizing?",
      "answers": [
        {
          "text": "Js Ts 8s",
          "is_correct": false,
          "explanation": "JsTs8s is a wet, dynamic board with flushes, straights, and combo draws. Small c-bets get raised cheaply and fail to deny equity to draws; use a larger size or split into a polarized strategy."
        },
        {
          "text": "9c 8d 6h",
          "is_correct": false,
          "explanation": "9c8d6h is a connected, two-tone board with many draws and straight possibilities. A small c-bet under-prices villain's draws and value-cuts your strong hands."
        },
        {
          "text": "K7 2 rainbow",
          "is_correct": true,
          "explanation": "K72 rainbow is the prototypical dry board: no draws, no two-card straights, no flush draws. Small c-bets extract value from underpairs and Kx, fold out overcards cheaply, and let your range stay protected."
        },
        {
          "text": "Ac Kh Qd",
          "is_correct": false,
          "explanation": "AKQ rainbow is high-card-heavy and hits villain's 3-bet calling range hard. Sizing is less important here than range selection; this is a check-heavy board for the c-bettor in many spots."
        }
      ],
      "glossary_terms": ["c-bet", "dry board", "wet board", "polarized"]
    },
    {
      "question_id": "cbet-q2-frequency",
      "type": "multiple_choice",
      "prompt": "You are the preflop raiser heads-up in position on a K72 rainbow flop versus the big blind. What is the most theoretically sound c-bet frequency at this node?",
      "answers": [
        {
          "text": "Check 100%",
          "is_correct": false,
          "explanation": "Checking 100% on K72 rainbow gives up massive EV. Your range crushes villain's range on this board; c-betting most of it is correct."
        },
        {
          "text": "C-bet around 80%",
          "is_correct": true,
          "explanation": "K72 rainbow is a clear high-frequency c-bet spot in position. Your range advantage and nut advantage justify firing most of your range for a small sizing, denying equity and getting thin value across the board."
        },
        {
          "text": "C-bet around 50%",
          "is_correct": false,
          "explanation": "A polarized 50% strategy is closer to right on dynamic boards. On K72 rainbow you can fire much more of your range cheaply, so 50% is too low."
        },
        {
          "text": "C-bet around 30%",
          "is_correct": false,
          "explanation": "30% would be appropriate on a board that hits villain's range hard (low connected boards). On K72 rainbow, you check too many strong hands and leave EV on the table."
        }
      ],
      "glossary_terms": ["c-bet", "range advantage", "nut advantage"]
    },
    {
      "question_id": "cbet-q3-sizing-with-overpair",
      "type": "multiple_choice",
      "prompt": "You hold QQ on a 7c 4d 2s flop, single raised pot vs. BB. What is the most theoretically sound c-bet sizing?",
      "answers": [
        {
          "text": "Check",
          "is_correct": false,
          "explanation": "Checking QQ here leaves a clear value bet on the table. Villain calls with underpairs, gutshots, and overcards that you crush; let them put money in."
        },
        {
          "text": "1/3 pot",
          "is_correct": true,
          "explanation": "Small sizing maximizes EV on dry boards: thin value from underpairs and floats, protection against overcards, and you keep villain's calling range wide. Going larger only folds out the hands you want to keep in."
        },
        {
          "text": "3/4 pot",
          "is_correct": false,
          "explanation": "Three-quarters pot is over-sized on dry boards. You bleed value when called by stronger hands and fold out the underpairs and overcard floats that pay off your small bet."
        },
        {
          "text": "Pot",
          "is_correct": false,
          "explanation": "A pot-sized bet here is a clear sizing leak. The board has no draws to charge, so the only effect of going large is folding out the hands that pay you off."
        }
      ],
      "glossary_terms": ["overpair", "c-bet", "thin value"]
    },
    {
      "question_id": "cbet-q4-marginal-spot",
      "type": "multiple_choice",
      "prompt": "You raised UTG with 8h 8d and the BTN calls. The flop is Kd 7c 2s. The BTN's range is wider than the BB's would be here. What is the best line?",
      "answers": [
        {
          "text": "Check and play passively",
          "is_correct": false,
          "explanation": "Checking 88 here passes the initiative to BTN's wide floats and lets them take the pot away on most turns. You give up too much EV in a spot where your made hand has equity against most of villain's range."
        },
        {
          "text": "Small c-bet (1/3 pot)",
          "is_correct": true,
          "explanation": "Small c-betting 88 on K72 gets thin value from worse pairs (66, 55, 44), denies equity to overcard floats, and lets your range stay strong on later streets. Villain rarely raises this board light enough to make a fold correct."
        },
        {
          "text": "Pot-sized bet",
          "is_correct": false,
          "explanation": "Pot-sized turns 88 into a polarized bluff candidate, which is the wrong category for a marginal made hand with limited equity vs. better Kx. Use small sizes with hands like this."
        },
        {
          "text": "Bet-fold to any check-raise",
          "is_correct": false,
          "explanation": "Bet-fold is too unbalanced unless you have a hard read. Small c-bet then play poker on the turn is the higher-EV default."
        }
      ],
      "glossary_terms": ["c-bet", "thin value", "polarized"]
    },
    {
      "question_id": "cbet-q5-hand-scenario-bluff",
      "type": "hand_scenario",
      "prompt": "You open AcJc UTG to $6, BB calls. Flop comes K7 2 rainbow. BB checks. Effective stacks are 100bb. What is the most theoretically sound action?",
      "answers": [
        {
          "text": "Check back",
          "is_correct": false,
          "explanation": "Checking back gives up the equity of a small c-bet and lets BB float-stab turn cards. With ace-high and a backdoor flush, you have enough equity and fold equity to fire."
        },
        {
          "text": "Small c-bet (1/3 pot)",
          "is_correct": true,
          "explanation": "Small c-bet uses your range advantage on K72 rainbow, picks up the pot vs. BB's whiffed broadways and small pairs, and keeps an A-high backdoor draw alive cheaply. Folding villain's overcards realizes equity on every turn."
        },
        {
          "text": "Overbet (1.5x pot)",
          "is_correct": false,
          "explanation": "Overbetting AJ on a dry board folds out the exact bluff catchers you want to fold but also costs you 3-4x more when raised. Stick to small for both the value and the bluffs on this texture."
        },
        {
          "text": "Bet 3/4 pot",
          "is_correct": false,
          "explanation": "Three-quarters pot is the wrong size category on K72 rainbow. It does not pressure villain enough more than 1/3 pot to justify the larger risk."
        }
      ],
      "table_state": {
        "street": "flop",
        "hero_position": "UTG",
        "hero_hole_cards": ["Ac", "Jc"],
        "board_cards": ["Kd", "7c", "2s"],
        "pot_size": 13,
        "stack_sizes": {
          "UTG": 194,
          "BB": 194
        },
        "villain_player_types": {
          "BB": "PLF"
        },
        "notes": "BB has been calling preflop wide and folding turn often when no obvious draw completes."
      },
      "glossary_terms": ["c-bet", "range advantage", "backdoor draw", "fold equity"]
    },
    {
      "question_id": "cbet-q6-hand-scenario-turn",
      "type": "hand_scenario",
      "prompt": "You c-bet 1/3 pot on K7 2 rainbow with QQ and the BB called. Turn is 4h. BB checks. What is the most theoretically sound action?",
      "answers": [
        {
          "text": "Check back",
          "is_correct": false,
          "explanation": "Checking back gives up clear value. QQ beats villain's calling range (small pairs, weak Kx, gutshots) handily; turn is a brick that does not change the texture."
        },
        {
          "text": "Bet 1/3 pot again",
          "is_correct": true,
          "explanation": "Continuing small extracts value from underpairs, weak Kx, and gutshots while protecting against overcards on the river. The board is still dry; same sizing on turn keeps your range protected."
        },
        {
          "text": "Bet 3/4 pot",
          "is_correct": false,
          "explanation": "Larger sizing on a dry turn folds out the underpairs and overcard floats that pay the small bet. Stick to the small sizing throughout on dry textures."
        },
        {
          "text": "Bet pot",
          "is_correct": false,
          "explanation": "Pot-sized on a dry turn is way too large for QQ. You only get called by stronger hands and fold out the worse hands you wanted to value-bet."
        }
      ],
      "table_state": {
        "street": "turn",
        "hero_position": "UTG",
        "hero_hole_cards": ["Qs", "Qh"],
        "board_cards": ["Kd", "7c", "2s", "4h"],
        "pot_size": 22,
        "stack_sizes": {
          "UTG": 190,
          "BB": 190
        },
        "villain_player_types": {
          "BB": "OMC"
        },
        "notes": "Villain has been call-call-fold passive on dry boards all session."
      },
      "glossary_terms": ["overpair", "c-bet", "thin value", "brick"]
    }
  ]
}
```

This example exercises every required field, both question types, two
streets in the hand scenarios, and three of the placeholder player-type
identifiers. Use it as the structural reference when prompting Claude.

---

## Tips for Claude prompts

Practical guidance from generating poker content with Claude. Keep this list
nearby; it is the difference between clean output and constant re-prompting.

- **Ask for variety explicitly.** Claude will pattern-repeat if you do not.
  Say "use a different player type and concept for each question" or "vary
  the street across the batch — at least two flop, two turn, one river" or
  "rotate through these positions: UTG, MP, CO, BTN."

- **Specify exact counts.** "Generate exactly 10 questions" works much
  better than "generate around 10 questions." Claude will hit the count
  literally and the validator will pass it. Vague counts produce 8 or 12 with
  no way to ask for "one more like the last one."

- **Demand a JSON array, not JSON in prose.** Append this to every prompt:
  "Output only the JSON array. No commentary, no markdown fences, no
  explanation before or after." Without it, Claude wraps the JSON in prose or
  triple backticks, and the validator UI does not strip them.

- **For hand scenarios, demand a populated `table_state`.** Claude will
  sometimes leave optional fields empty when they would obviously help. Be
  explicit: "Populate `street`, `hero_position`, `hero_hole_cards`,
  `board_cards`, `pot_size`, `stack_sizes`, and `villain_player_types` for
  every hand scenario."

- **Be explicit about units in pot and stack sizes.** "Use big blinds, not
  dollars" or "use dollars; this is a live $1/$2 cash game" — Claude
  defaults inconsistently otherwise. Be consistent within a lesson; do not
  let Claude mix units across questions.

- **Validate before importing.** Paste Claude's output into the validator
  UI. The error messages tell you exactly what is wrong, and you can ask
  Claude to fix specific issues by referencing the path. Example follow-up
  prompt: "Re-do question 3 — it currently has 3 answers but needs exactly 4. Add one more wrong answer with a teaching-quality explanation."

- **Save successful prompts.** Once a prompt template produces clean output
  for one batch, save it as a snippet. Re-using a known-good prompt with
  small edits ("change concept to X, swap player types to Y") is far faster
  than re-engineering from scratch.

- **Have Claude critique its own first draft.** Paste the schema, ask for the
  batch, then in a follow-up message say: "Review each question. For every
  question, check (a) exactly 4 answers, (b) exactly 1 is_correct, (c) every
  explanation is non-empty and teaches something, (d) hand_scenarios have a
  full table_state. List any violations as a bullet list." Claude is good at
  self-review when prompted explicitly.

- **For wrong-answer explanations, demand the leak.** "Explain what
  specifically goes wrong if a player picks this answer — what range they
  lose to, what they miss out on, what tilt or sizing leak it represents." A
  generic "this is incorrect because the right answer is X" is unteachable.

- **For right-answer explanations, demand the EV mechanism.** "Explain why
  this answer is correct in terms of EV against villain's range — value, fold
  equity, protection, or initiative — not just 'this is the standard line.'"

- **Iterate on principle alignment.** After a batch, ask Claude: "For each
  question, restate the principle_tag and one sentence describing how the
  correct answer demonstrates that principle." Use the answers to check
  whether the batch actually reinforces the principle or just talks around
  it.

- **Use the validator as a teacher.** The error messages were written for a
  tester to read. If an error message is unclear, that is a bug in the
  schema, not in the content. Open an issue and the message can be improved.

---

## Reference: file locations in the repository

For implementers and maintainers (not for content generation).

- Zod schema: `shared/schemas/lesson.ts`
- Validator: `src/lib/validate.ts`
- Validator UI: `src/components/LessonValidator.tsx`
- Versions panel: `src/components/VersionsPanel.tsx`
- Staging Supabase client: `src/lib/supabase.ts`
- Production Supabase client: `src/lib/supabase-prod.ts`
- Promote Edge Function: `supabase/functions/promote-to-prod/index.ts`
- Rollback Edge Function: `supabase/functions/rollback-to-version/index.ts`
- Sample valid lesson: `samples/valid-lesson.json`
- Sample invalid lesson: `samples/invalid-lesson.json`
- Migrations: `supabase/migrations/`

If you update the schema, this document must be updated in the same change.
Drift between this document and `shared/schemas/lesson.ts` is the single
fastest way to destroy the bulk-content workflow.
