# QA Guide

How to verify that work is correct, complete, and ready to ship. This document is the QA reference for the Poker Trainer project, written with the assumption that the client is a former QA engineer who will scrutinize the work.

The standard: nothing ships until it passes its acceptance criteria. Acceptance criteria are written, not implicit. Verification is documented, not assumed.

---

## Table of contents

1. [QA philosophy](#qa-philosophy)
2. [Definition of Done framework](#definition-of-done-framework)
3. [Acceptance criteria templates](#acceptance-criteria-templates)
4. [Per-milestone acceptance gates](#per-milestone-acceptance-gates)
5. [Module-by-module checklists](#module-by-module-checklists)
6. [Validator testing scenarios](#validator-testing-scenarios)
7. [Content pipeline test procedures](#content-pipeline-test-procedures)
8. [Cross-environment verification](#cross-environment-verification)
9. [Browser and device matrix](#browser-and-device-matrix)
10. [Accessibility checks](#accessibility-checks)
11. [Performance baselines](#performance-baselines)
12. [Security checks](#security-checks)
13. [Bug reporting format](#bug-reporting-format)
14. [Regression checklist](#regression-checklist)

---

## QA philosophy

1. **Verification is not optional.** Every milestone has explicit acceptance criteria that must pass before the milestone is marked complete and approval is requested.
2. **The validator is itself a deliverable.** Its error messages, field paths, and behavior are user-facing and must be tested directly.
3. **Manual testing is the primary verification method.** Automated tests support manual QA but do not replace it.
4. **The user is a QA engineer.** Edge cases, error handling, and clear failure modes matter more than feature breadth.
5. **Document what was checked.** A passing checklist is the artifact that proves a deliverable was verified.

---

## Definition of Done framework

### Task-level Definition of Done

A task is done when:

- [ ] The code change implements the described behavior
- [ ] `npm run build` passes with no errors and no new warnings
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Manual smoke test in the browser confirms the change works as described
- [ ] No regressions in adjacent functionality (run the regression checklist for affected areas)
- [ ] Code follows CLAUDE.md conventions
- [ ] Commit is on a feature branch with a conventional commit message
- [ ] Self-review of the diff before requesting review (or merging if no reviewer)
- [ ] If UI changed: screenshot or short clip captured in the PR description

### Module-level Definition of Done

A module (e.g., "the validator UI," "the promote Edge Function," "the glossary drawer") is done when:

- [ ] All tasks within the module pass task-level DoD
- [ ] Module-specific acceptance criteria (in this document) are all checked off
- [ ] Module integrates correctly with adjacent modules (cross-module smoke test)
- [ ] Module's API or interface is documented (types, function signatures, props) so the next module can integrate against it
- [ ] Any new entry points (routes, Edge Function endpoints, component exports) are added to relevant documentation
- [ ] No console errors or warnings during normal use of the module

### Milestone-level Definition of Done

A milestone is done when:

- [ ] Every module within the milestone passes module-level DoD
- [ ] The full milestone acceptance gate checklist (below) passes end-to-end
- [ ] Manual test plan executed and documented
- [ ] No P0 or P1 bugs open
- [ ] P2 bugs documented in the backlog
- [ ] Deployment to staging verified
- [ ] Deployment to production verified (where applicable for the milestone)
- [ ] Rollback procedure tested at least once for the milestone's content/code changes
- [ ] Brief handoff notes written for the milestone (what changed, where to find it, what's next)
- [ ] Client approval requested via Upwork milestone submission

---

## Acceptance criteria templates

Every task should have written acceptance criteria before work starts. The template:

```
GIVEN [precondition / starting state]
WHEN [action taken by user or system]
THEN [observable outcome]
AND [secondary outcome, if any]
```

**Example for "Validator displays errors with field paths":**

```
GIVEN the validator UI is loaded and contains lesson JSON that violates schema rules
WHEN the user clicks "Validate"
THEN a red panel appears below the action row
AND each error is rendered on its own line
AND each error shows: human-readable path (font-mono) followed by the error message
AND the count of errors matches the count of distinct schema violations
AND the textarea content is unchanged
```

**Example for "Promote-to-prod Edge Function creates version snapshot":**

```
GIVEN a lesson exists in lessons_staging with content matching the Zod schema
WHEN the promote-to-prod Edge Function is invoked with that lesson_id
THEN the function returns { ok: true, lesson_id, version_number }
AND a new row exists in lesson_versions for that lesson_id with the staging content
AND the version_number is exactly (previous_max_version + 1) or 1 if no prior versions
AND lessons_published contains the same content with current_version matching the new version
AND created_by on the new lesson_versions row is "promote"
AND source_version on the new row is null
```

Acceptance criteria are written once, in the task description, and checked off during verification.

---

## Per-milestone acceptance gates

### M1: Foundation, Static Table UI, Q&A Interface, Glossary, Bulk Import, PWA Scaffold

The end-of-M1 demo demonstrates:

- [ ] The static 9-max poker table renders cleanly on a 360px-wide mobile viewport
- [ ] Nine seats are visible without overflow or overlap
- [ ] Player-type avatars (placeholder or supplied) appear at appropriate seats and are tappable
- [ ] Tapping a player-type avatar opens a short explainer drawer
- [ ] The multiple-choice question interface displays exactly 4 answer options
- [ ] Selecting an answer opens a slide-up feedback drawer with teaching commentary
- [ ] Glossary terms in question text and explanations are visually distinct (e.g., underlined) and tappable
- [ ] Tapping a glossary term opens the definition drawer
- [ ] Nested glossary linking works: tapping a term reference inside a definition opens a new definition, with a back navigation stack
- [ ] The back stack returns to the previous definition in reverse order
- [ ] Closing the glossary drawer returns the user to the exact previous state (question, answer drawer state)
- [ ] Bulk import: paste a JSON batch of lessons into the upload UI, click validate, see errors or success per lesson, save valid lessons to staging
- [ ] Bulk import handles 50+ lessons in a single batch without UI freeze
- [ ] PWA install prompt appears in supported browsers
- [ ] App can be installed to home screen on iOS and Android
- [ ] Installed PWA opens in standalone mode (no browser chrome)
- [ ] Service worker is registered (visible in DevTools → Application → Service Workers)
- [ ] App shell loads from cache when offline (basic offline-tolerance, not full offline functionality)
- [ ] Entitlements + auth schema is in place in the Supabase staging project (tables, RLS policies, even if not yet wired to Stripe)

### M2: Quiz Engine, CMS Backbone, Today's Tip + Saved Tips + References

The end-of-M2 demo demonstrates:

**Quiz engine:**

- [ ] Lesson flows from concept intro through question sequence to final session score
- [ ] Per-answer scoring is recorded
- [ ] Session completion writes to user_progress
- [ ] Members can run sessions in randomized order (no fixed prerequisite chain)
- [ ] Missed questions can be reviewed at end of session
- [ ] Members can star/save individual questions during a session
- [ ] Saved questions persist across sessions in a "Saved Questions" view

**CMS authoring wizard:**

- [ ] Wizard branches by question type (multiple_choice vs hand_scenario) on first selection
- [ ] For multiple_choice: 4 answer slots required, exactly 1 marked correct, explanation required per answer
- [ ] For hand_scenario: visual interactive table builder is reachable
- [ ] Table builder allows: place 1-9 players on seats, assign player type per seat (dropdown of locked codes), set stack sizes, move dealer button, set hole cards from a card picker, set board cards
- [ ] Wizard saves a lesson to staging via the same validator as the paid test
- [ ] Validation errors are displayed inline in the wizard with the field-path-precise messages
- [ ] Author can edit and re-save without losing other fields

**Bulk import/export:**

- [ ] CSV import works for tabular content
- [ ] JSON import works for arbitrary content shapes matching the schema
- [ ] Markdown import works (lessons authored in Markdown convert to schema-conformant JSON)
- [ ] Export produces the same format that import accepts (round-trip lossless)
- [ ] The import schema markdown spec (`docs/schema-spec.md`) is up to date with the final V1 content model

**Content pipeline generalization:**

- [ ] Tables renamed to `content_*` with `content_type` discriminator
- [ ] Lessons, Tips, References, and Path nodes all run through the same Edge Functions
- [ ] Versioning works identically for every content type
- [ ] Rollback works identically for every content type

**Pipeline hardening:**

- [ ] Server-side re-validation runs inside the promote Edge Function before publishing
- [ ] Server-side re-validation runs inside the rollback Edge Function before restoring
- [ ] Admin auth gate is in place on the validator UI (`/admin/validator`)
- [ ] Admin auth gate is in place on the wizard UI (`/admin/wizard`)
- [ ] CORS allow-list on Edge Functions restricts to the actual Vercel staging and production domains
- [ ] Non-admin users cannot reach `/admin/*` routes; redirected to home or login

**Today's Tip + Saved Tips + References Library:**

- [ ] Today's Tip surface on home/dashboard rotates daily
- [ ] Members can save tips, organized in a Saved Tips list under their profile
- [ ] References Library displays cheat sheets, Character Mapping reference, and methodology references
- [ ] All Tips, References, and Path nodes are authored through the same CMS wizard
- [ ] All flow through the same validate → stage → publish → rollback pipeline

### M3: Auth, Entitlements, Stripe Subscriptions, Real-time GHL Sync, Event Logging

The end-of-M3 demo demonstrates:

- [ ] New user can sign up via Supabase Auth with email + password
- [ ] Stripe checkout for the standard $27/mo price completes successfully
- [ ] Stripe webhook fires on successful payment
- [ ] User receives the `quiz_app_access` entitlement immediately after payment
- [ ] User can log in immediately post-purchase (no email link required for first access)
- [ ] Magic link recovery flow works for forgotten passwords
- [ ] Logged-in entitled user can access protected app routes
- [ ] Logged-in non-entitled user (expired or cancelled subscription) is redirected away from protected routes
- [ ] Cancelling a Stripe subscription removes/expires the entitlement
- [ ] Failed payment events update entitlement status appropriately
- [ ] Multiple price points (test with $27/mo and $47/mo Stripe products) both grant the same `quiz_app_access` entitlement
- [ ] Adding a new Stripe price requires zero code changes (verified by manually adding a third price in Stripe and confirming entitlement is granted)
- [ ] GHL receives the subscription event via the webhook within 10 seconds of the Stripe event
- [ ] GHL custom fields are updated correctly (subscription status, plan, etc.)
- [ ] Every answer submitted by a user creates a row in `answer_events`
- [ ] `answer_events` records: user_id, question_id, lesson_id, is_correct, selected_answer, time_taken_ms, created_at

### M4: Skills Path, Streaks, Push, Badges, Onboarding, Leaderboard, QA, Deploy

The end-of-M4 demo demonstrates:

**Skills Path:**

- [ ] Visual progression map renders with skill nodes and connecting paths
- [ ] Node states: locked (greyed), available (highlighted), in progress, mastered
- [ ] Completing a lesson updates the corresponding node state
- [ ] Dependencies between nodes work: completing a prerequisite unlocks downstream nodes
- [ ] Members can still run lessons in randomized free-practice order from any unlocked node

**Streaks and badges:**

- [ ] Daily streak counter increments correctly across day boundaries (UTC)
- [ ] Streak resets to 0 if a day is missed
- [ ] Streak counter is visible on the dashboard
- [ ] Streak reminder push notification fires when a user is at risk of breaking their streak (verified by sending a test push)
- [ ] Badges are awarded on defined milestones (first session, first streak, X lessons complete, X% accuracy, etc.)
- [ ] Badges have decay/mastery-maintenance logic: badges visually fade after a defined inactivity period
- [ ] Re-engagement (completing relevant content) restores faded badges
- [ ] Monthly contest leaderboard ranks members by quiz performance
- [ ] Leaderboard resets monthly
- [ ] Member sees their own rank on the leaderboard

**Onboarding:**

- [ ] First-login flow appears on the user's very first authenticated session
- [ ] Onboarding is skippable from any step
- [ ] Onboarding includes a warm-up lesson with a curated low-friction first session
- [ ] Member completes the warm-up and sees a "first session complete" celebration animation
- [ ] First-correct, first-streak, first-badge each trigger their own celebration animation

**PWA push:**

- [ ] Push permission flow runs after onboarding or via a settings toggle
- [ ] User can subscribe to push notifications
- [ ] Push subscription is stored server-side
- [ ] Scheduled push notifications fire (streak reminders verified end-to-end)
- [ ] Push notifications work on iOS 16.4+ installed PWA
- [ ] Push notifications work on Android Chrome installed PWA
- [ ] Push notifications work on desktop Chrome
- [ ] Clicking a push notification opens the relevant app screen

**Progress dashboard:**

- [ ] Per-member dashboard shows questions answered, accuracy rate, sessions completed
- [ ] Improvement-over-time trend is visible (chart or stat group)
- [ ] Today's Tip is visible on the dashboard
- [ ] Outbound links to the client's website (upgrades, discounts) are present

**Deploy:**

- [ ] App is deployed to the client's domain via Vercel
- [ ] SSL/TLS certificate is valid and HTTPS works
- [ ] Both staging and production environments are fully configured
- [ ] Vercel one-click deployment revert is tested at least once (deploy a known-bad commit, revert it, confirm the previous version is restored)
- [ ] Supabase content rollback is tested at least once (promote content, rollback, confirm previous version is live)

**Full QA pass:**

- [ ] Browser matrix (see below) verified
- [ ] Accessibility checklist verified
- [ ] Performance baselines met
- [ ] Security checklist verified
- [ ] No P0 or P1 bugs open

---

## Module-by-module checklists

### Static 9-max poker table

- [ ] All 9 seats visible on 360px viewport
- [ ] Seats don't overlap on any viewport from 360px to 1920px
- [ ] Hero seat (position-aware) is clearly indicated
- [ ] Dealer button is visible and positioned at the correct seat
- [ ] Blind chips/markers are visible at SB and BB positions
- [ ] Pot size displays prominently in the center
- [ ] Community cards display in the center, aligned and equally spaced
- [ ] Hero hole cards display below or near the hero seat
- [ ] Player-type avatars at relevant seats render without distortion at small sizes (40x40, 80x80)
- [ ] Tapping an avatar opens a drawer with the player type explainer
- [ ] The explainer drawer can be dismissed by swipe-down or tap-outside
- [ ] No animations during card display (static rendering only)

### Multiple-choice question interface

- [ ] Exactly 4 answer options always render
- [ ] Each answer is clickable/tappable on mobile and desktop
- [ ] Selected answer is visually distinct
- [ ] After selection, feedback drawer slides up
- [ ] Feedback shows the correct/incorrect indicator
- [ ] Feedback shows teaching commentary
- [ ] Feedback shows explanations for ALL answers (not just the selected one), so member learns why each is right or wrong
- [ ] Tapping a glossary term within the feedback opens the glossary drawer above the feedback
- [ ] Closing the glossary drawer returns to the feedback drawer
- [ ] Closing the feedback drawer returns to the question state but disabled (member cannot re-answer the same question in the same session)
- [ ] Session-level navigation (next question button) is enabled only after feedback has been viewed

### Glossary drawer

- [ ] Tappable glossary terms in question text are visually distinct (underline, color, or icon)
- [ ] Tapping a term opens a drawer from the bottom
- [ ] Drawer contains: term, plain-language definition, importance indicator, specific-situation example, example usage
- [ ] Nested links within the definition body are themselves tappable
- [ ] Tapping a nested link opens a new drawer overlay
- [ ] A back-arrow/swipe gesture returns to the previous drawer
- [ ] Navigation stack supports at least 5 levels deep without breakage
- [ ] Closing the drawer (top-level or any level) returns to the underlying app state intact

### Validator UI

- [ ] Page loads with empty textarea and no panels below
- [ ] "Load Sample (Valid)" populates the textarea with sample JSON pretty-printed
- [ ] "Load Sample (Invalid)" populates with broken sample JSON
- [ ] Loading a sample clears any previous validation result
- [ ] Loading a sample clears any previous save status
- [ ] Editing the textarea clears any previous validation result
- [ ] Editing the textarea clears any previous save status
- [ ] Clicking "Validate" with malformed JSON shows "Invalid JSON: <parse error>"
- [ ] Clicking "Validate" with valid JSON that fails schema shows the error list
- [ ] Each error shows a human-readable path (font-mono) and a plain-English message
- [ ] Path format suppresses redundant parent segments before numeric indices (e.g., "question 3, answers, answer 2, explanation" not "questions, question 3, answers, answer 2, explanation")
- [ ] Clicking "Validate" with valid content that passes shows green "✓ Valid lesson" with title and question count
- [ ] "Save to Staging" button is disabled until validation passes
- [ ] Clicking "Save to Staging" shows "Saving..." then "Saved to staging as lesson_id: <id>"
- [ ] Failure to save shows the error message in red
- [ ] Verified in Supabase dashboard: the saved row exists with correct content

### Promote-to-prod Edge Function

- [ ] POST request to the function with a valid lesson_id succeeds
- [ ] Response is JSON `{ ok: true, lesson_id, version_number }`
- [ ] First promotion for a lesson_id creates version_number 1
- [ ] Subsequent promotions increment version_number sequentially
- [ ] `lesson_versions` table has a row with: correct lesson_id, correct version_number, full content JSON, created_at timestamp, created_by = "promote", source_version = null
- [ ] `lessons_published` table has the lesson_id with the promoted content and current_version matching the new version_number
- [ ] Request with non-existent lesson_id returns 404 with `{ ok: false, message: "Lesson not found in staging" }`
- [ ] Request with invalid body (missing lesson_id) returns 400
- [ ] CORS allows requests from the staging and production Vercel domains
- [ ] CORS blocks requests from unauthorized origins (M2)
- [ ] Service role keys are not exposed in any response
- [ ] Error responses don't leak internal stack traces

### Rollback-to-version Edge Function

- [ ] POST with valid lesson_id and target_version succeeds
- [ ] Response is JSON `{ ok: true, lesson_id, version_number, rolled_back_from }`
- [ ] New `lesson_versions` row created with: incremented version_number, content from target_version, created_by = "rollback", source_version = target_version
- [ ] `lessons_published` updated with the target_version's content and current_version = new version_number
- [ ] No prior versions are deleted or modified
- [ ] Request with non-existent target_version returns 404
- [ ] Multiple rollbacks chain correctly (rollback v1 → creates v3; then rollback v2 → creates v4 from v2)

### Stripe webhook handler

- [ ] Receives `customer.subscription.created` event and creates entitlement
- [ ] Receives `customer.subscription.updated` event and updates entitlement (e.g., paused → active)
- [ ] Receives `customer.subscription.deleted` event and revokes entitlement
- [ ] Receives `invoice.payment_failed` event and handles per business rules
- [ ] Signature verification rejects events with invalid signatures
- [ ] Replay protection: re-sending the same event is idempotent
- [ ] After processing, calls the GHL sync function with relevant fields

### GHL sync function

- [ ] Receives subscription event from Stripe webhook
- [ ] Calls GHL API to update the contact's subscription status
- [ ] Updates custom fields: subscription_status, plan, current_period_end
- [ ] Adds appropriate tags (e.g., "quiz_app_subscriber")
- [ ] Removes tags on cancellation
- [ ] Logs success/failure for audit trail
- [ ] Retries on transient GHL API failures (with exponential backoff, max 3 retries)

---

## Validator testing scenarios

The validator's correctness is critical because Claude-generated content depends on it. Test every rule with at least one positive and one negative case.

### Positive cases (validator MUST accept)

- [ ] Lesson with all required top-level fields and 1 question
- [ ] Lesson with 10 questions: mix of multiple_choice and hand_scenario
- [ ] Multiple_choice question with exactly 4 answers, exactly 1 correct, all explanations non-empty
- [ ] Hand_scenario with full table_state (street, hero_position, hero_hole_cards, board_cards, pot_size, stack_sizes, villain_player_types)
- [ ] Hand_scenario with minimal table_state (just street and hero_position)
- [ ] Lesson with optional `difficulty` field set
- [ ] Lesson with optional `difficulty` field omitted
- [ ] Question with optional `glossary_terms` array
- [ ] Question without `glossary_terms`
- [ ] Lesson with the maximum realistic number of questions (50+)

### Negative cases (validator MUST reject with specific message)

- [ ] Lesson missing `lesson_id` → message references `lesson_id`
- [ ] Lesson with empty `lesson_id` → message indicates non-empty required
- [ ] Lesson missing `title` → message references `title`
- [ ] Lesson missing `principle_tag` → message references `principle_tag`
- [ ] Lesson missing `concept` → message references `concept`
- [ ] Lesson with empty questions array → message indicates at least 1 question required
- [ ] Question missing `question_id` → "question N, question_id" path
- [ ] Question missing `type` → message references type
- [ ] Question with type "trivia" (invalid enum) → "type must be either 'multiple_choice' or 'hand_scenario'"
- [ ] Question missing `prompt` → message references prompt
- [ ] Multiple_choice with 3 answers → "MCQ questions must have exactly four answers"
- [ ] Multiple_choice with 5 answers → same message
- [ ] Multiple_choice with 0 correct answers → "Exactly one answer must have is_correct=true"
- [ ] Multiple_choice with 2 correct answers → same message
- [ ] Answer with empty text → "Answer text is required"
- [ ] Answer with empty explanation → "Explanation is required for every answer"
- [ ] Hand_scenario without table_state → message references table_state
- [ ] Hand_scenario with invalid street ("fifth_street") → "street must be one of preflop, flop, turn, river"
- [ ] Hand_scenario with negative pot_size → message indicates non-negative
- [ ] Hand_scenario with empty hero_position → message indicates non-empty
- [ ] Question with player_type outside the locked enum (e.g., "rookie") → message lists allowed values
- [ ] Principle_tag outside the locked enum → message lists allowed values

### Validator UX testing

- [ ] Error count matches the number of distinct violations
- [ ] Errors are listed in document order (top to bottom in the JSON)
- [ ] Path segments use plain English ("question 3" not "questions[2]")
- [ ] Multiple errors in one question are listed separately, not aggregated
- [ ] Whitespace-only string values fail non-empty checks
- [ ] Numbers as strings (e.g., "100" instead of 100) for pot_size fail with type message
- [ ] Boolean as string for is_correct fails with type message

---

## Content pipeline test procedures

The end-to-end content pipeline (the paid test deliverable) must work flawlessly.

### Full round-trip test

1. **Load valid sample** in validator UI
2. **Click Validate** → expect green panel
3. **Click Save to Staging** → expect "Saved to staging as lesson_id: <id>"
4. **Open staging Supabase dashboard** → confirm row exists in `lessons_staging` (or `content_staging` post-M2)
5. **Click Promote to Production** → expect "Promoted to production as v1"
6. **Open production Supabase dashboard** → confirm row exists in `lessons_published` with current_version: 1
7. **Open production `lesson_versions`** → confirm row exists with version_number: 1, created_by: "promote", source_version: null
8. **Edit the lesson title** in the textarea
9. **Click Validate** → expect green
10. **Click Save to Staging** → confirm staging row updated
11. **Click Promote to Production** → expect "Promoted to production as v2"
12. **Confirm in production**: lessons_published.current_version = 2, lesson_versions has v1 and v2
13. **Open versions panel in UI** → confirm v1 and v2 visible
14. **Click Rollback on v1** → confirm dialog appears
15. **Confirm rollback** → expect "Rolled back to v1; production now at v3"
16. **Confirm in production**: lessons_published content matches v1 content, current_version = 3, lesson_versions has v1, v2, v3 (v3.created_by = "rollback", v3.source_version = 1)
17. **Try Promote when staging is empty** → expect 404 error message
18. **Load invalid sample** → Validate → expect 4 errors
19. **Confirm Save and Promote buttons are disabled** when validation has failed

This sequence is the canonical pipeline acceptance test. Run it before any milestone submission.

### Bulk import test

1. Prepare a JSON file with 50 lessons of mixed type
2. Use the bulk import UI to upload the file
3. Confirm progress is reported (e.g., "Validating 50 lessons...")
4. Confirm the result lists: total lessons, valid lessons, invalid lessons
5. For valid lessons: confirm rows appear in staging
6. For invalid lessons: confirm an error report is downloadable or visible with lesson_id and specific errors
7. Confirm partial success: valid lessons are saved even if some failed
8. Repeat with a CSV file
9. Repeat with a Markdown file

---

## Cross-environment verification

The staging and production environments must be functionally equivalent but data-isolated.

### Equivalence checks

- [ ] Schema in staging matches schema in production (all tables, columns, RLS policies)
- [ ] Edge Functions deployed to both projects (where applicable)
- [ ] Auth providers configured identically (Email provider enabled, password requirements, etc.)
- [ ] Storage buckets created identically
- [ ] Environment variables on Vercel point to the right Supabase project per branch

### Isolation checks

- [ ] Promoting content from staging never reads from production
- [ ] Production users cannot read staging data (separate auth domains)
- [ ] Staging data is never visible to authenticated production members
- [ ] Test transactions on staging Stripe (test keys) never flow to production GHL

---

## Browser and device matrix

V1 must work cleanly on:

| Browser                 | OS        | Notes                      |
| ----------------------- | --------- | -------------------------- |
| Chrome (latest stable)  | Windows   | Primary desktop            |
| Chrome (latest stable)  | macOS     | Primary desktop            |
| Safari (latest stable)  | macOS     | Tested for PWA install     |
| Safari (latest stable)  | iOS 16.4+ | Critical: PWA push support |
| Chrome                  | Android   | Primary mobile             |
| Firefox (latest stable) | Windows   | Tested for compatibility   |
| Edge (latest stable)    | Windows   | Tested for compatibility   |

Per browser, test:

- [ ] Page renders correctly
- [ ] Buttons clickable
- [ ] Drawers open and close
- [ ] PWA install prompt appears
- [ ] After install, opens in standalone mode
- [ ] Service worker activates
- [ ] Web push permission flow works (where supported)

---

## Accessibility checks

WCAG 2.1 AA is the baseline target. Per page:

- [ ] All interactive elements are reachable by keyboard (Tab navigates, Enter/Space activates)
- [ ] Focus indicators are visible (no `outline: none` without a replacement focus ring)
- [ ] Form inputs have associated `<label>` elements or `aria-label`
- [ ] Color contrast ratios meet AA (4.5:1 for normal text, 3:1 for large text)
- [ ] Images have meaningful `alt` text (or `alt=""` if decorative)
- [ ] Buttons say what they do (not "click here")
- [ ] Modal drawers trap focus while open
- [ ] Closing a modal returns focus to the trigger element
- [ ] Errors are announced to screen readers (use `role="alert"` or `aria-live`)
- [ ] Loading states have text or `aria-busy`, not just spinners
- [ ] No reliance on color alone to convey meaning (errors have icons or labels, not just red color)

Tools:

- axe DevTools browser extension for automated checks
- VoiceOver (macOS), TalkBack (Android), or NVDA (Windows) for screen reader spot-checks

---

## Performance baselines

| Metric                         | Target                           | How to measure                 |
| ------------------------------ | -------------------------------- | ------------------------------ |
| Largest Contentful Paint (LCP) | < 2.5s on 4G                     | Chrome DevTools Lighthouse     |
| First Input Delay (FID)        | < 100ms                          | Lighthouse                     |
| Cumulative Layout Shift (CLS)  | < 0.1                            | Lighthouse                     |
| Time to Interactive (TTI)      | < 4s on 4G                       | Lighthouse                     |
| Bundle size (initial JS)       | < 250 KB gzipped                 | `vite build` output            |
| Validator validation time      | < 200ms for a 10-question lesson | Manual timing                  |
| Promote Edge Function          | < 1.5s end-to-end                | Manual timing or function logs |
| Page transitions               | Feel instant (< 200ms perceived) | Manual feel                    |

Run Lighthouse in incognito mode with no extensions, on a throttled 4G connection.

---

## Security checks

- [ ] No service role keys in client code or git history
- [ ] No Stripe secret keys in client code or git history
- [ ] No GHL API keys in client code or git history
- [ ] `.env.local` is in `.gitignore`
- [ ] All RLS policies are tested: anonymous users blocked from user-data tables, users can only access their own rows
- [ ] CORS allow-list restricts Edge Functions to specific Vercel domains in production
- [ ] HTTPS enforced everywhere (Vercel handles this automatically)
- [ ] User input is never concatenated into SQL (always parameterized via supabase-js)
- [ ] User input is never rendered as HTML (no `dangerouslySetInnerHTML` for user content)
- [ ] Stripe webhooks verify signature before processing
- [ ] Failed login attempts have rate limiting (Supabase handles by default; verify it's enabled)
- [ ] Password reset flow uses Supabase magic link, never custom token logic

---

## Bug reporting format

Use this template when filing a bug:

```
**Title:** [Concise summary, e.g., "Promote button stays enabled after rollback"]

**Severity:** P0 / P1 / P2 / P3 (see scale below)

**Environment:**
- Browser/OS: Chrome 120 / macOS 14
- Environment: production / staging / local dev
- URL: <where it happened>
- User account: <if applicable; never include passwords>

**Steps to reproduce:**
1. Navigate to ...
2. Click ...
3. Observe ...

**Expected behavior:**
[What should have happened]

**Actual behavior:**
[What actually happened]

**Screenshots / video:**
[Attach if relevant]

**Console output / network errors:**
[Paste relevant error messages]

**Additional context:**
[Anything else]
```

### Severity scale

- **P0 (Critical):** Production is broken. Users cannot use the app. Data loss risk. Immediate fix.
- **P1 (High):** Major feature is broken. Workaround exists but painful. Fix in current milestone.
- **P2 (Medium):** Feature partially broken. Workaround easy. Fix in next milestone.
- **P3 (Low):** Polish, minor cosmetic, edge case. Fix when convenient.

---

## Regression checklist

Run this checklist before submitting any milestone for client approval, and before any production deploy.

**Always:**

- [ ] App loads with no console errors in production build
- [ ] All routes (`/`, `/drill/:id`, `/library`, `/profile`, `/admin/validator`) load without error
- [ ] Validator round-trip (validate → save → promote → rollback) works end-to-end
- [ ] Login flow works (where implemented)
- [ ] No new console warnings introduced
- [ ] No new TypeScript errors
- [ ] Lighthouse score for the home page hasn't regressed (within 5 points)
- [ ] PWA install prompt appears (in supported browsers)
- [ ] Service worker is active

**For UI changes:**

- [ ] Page renders correctly on mobile (360px viewport)
- [ ] Page renders correctly on tablet (768px viewport)
- [ ] Page renders correctly on desktop (1280px viewport)
- [ ] Touch targets are at least 44x44 pixels
- [ ] No layout shift after initial render

**For data/schema changes:**

- [ ] Migrations applied to both staging and production
- [ ] Existing content still validates (no breaking schema changes without a migration plan)
- [ ] RLS policies tested for the affected table(s)

**For Edge Function changes:**

- [ ] Function deploys successfully
- [ ] Function logs are clean (no unhandled errors)
- [ ] Function CORS headers are correct
- [ ] Function returns the expected response shape

Document the regression run in the milestone submission notes.
