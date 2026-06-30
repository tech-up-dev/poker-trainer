# Project Management Guide

Operational playbook for managing the Poker Trainer project from a PM perspective. This is your internal tool: tracking progress, preparing for calls with the client, managing risks, capturing decisions, and keeping forward momentum.

This document does NOT include financials or estimates. Those live in the proposal and Upwork. This is purely about execution.

---

## Table of contents

1. [Project shape](#project-shape)
2. [Milestone tracking framework](#milestone-tracking-framework)
3. [Weekly cadence](#weekly-cadence)
4. [Client call preparation](#client-call-preparation)
5. [Status reporting](#status-reporting)
6. [Risk register](#risk-register)
7. [Decision log](#decision-log)
8. [Change management](#change-management)
9. [Acceptance signoff workflow](#acceptance-signoff-workflow)
10. [Stakeholder map and communication preferences](#stakeholder-map-and-communication-preferences)
11. [Quality bar](#quality-bar)
12. [Forward-looking dependencies](#forward-looking-dependencies)

---

## Project shape

**Product:** Poker Trainer (Beat Small Stakes app). A subscription-gated, mobile-first PWA with Duolingo-style learning experience built around the client's Controlled Chaos methodology.

**Two workstreams running in parallel within each milestone:**

1. **Member-facing app:** quiz engine, static 9-max table, glossary, Skills Path, dashboard, gamification, PWA, push.
2. **Content Operations backbone (CMS):** validator, wizard authoring, visual table builder, bulk import/export, versioning, staging/prod, rollback.

**Milestones (V1):**

- **M1:** Foundation, Static Table UI, Q&A Interface, Glossary (with nested linking), Bulk Import, PWA Scaffold
- **M2:** Quiz Engine, CMS Backbone, Today's Tip + Saved Tips + References (the heaviest milestone)
- **M3:** Auth, Entitlements, Stripe Subscriptions, Real-time GHL Sync, Event Logging
- **M4:** Skills Path, Streaks, Push, Badges, Onboarding, Leaderboard, QA, Deploy

**Paid test (already complete):** validate-and-publish round trip, schema documentation. Code carries into M1.

**Critical principles:**

- Staging-first for everything (schema, content, deploys)
- Two-layer rollback (code via Vercel, content via Supabase)
- Single content pipeline serving all content types
- Client authors content; developer builds the pipeline
- Mobile-first design, PWA only (no native apps)

---

## Milestone tracking framework

For each milestone, maintain a tracking sheet (in your preferred tool: a markdown file in `docs/`, a GitHub Project, Notion, etc.) with:

### Milestone scorecard template

```
## Milestone: <name>

**Status:** Not started | In progress | In review | Approved
**Started:** <date>
**Target completion:** <date>
**Actual completion:** <date>

### Deliverables
- [ ] Deliverable 1
- [ ] Deliverable 2
- [ ] ...

### Modules
| Module | Status | Notes |
|--------|--------|-------|
| Module A | Not started / In progress / Done | |
| Module B | | |

### Open questions
- Question 1: <description>. Owner: <client | dev>. Needed by: <date>.

### Risks
- Risk 1: <description>. Likelihood: low/med/high. Impact: low/med/high. Mitigation: ...

### Test plan execution
- [ ] Acceptance gate checklist from QA_GUIDE.md run
- [ ] Regression checklist run
- [ ] Manual demo dry-run with the build complete
- [ ] Recorded Loom of the demo (optional, helpful for async review)

### Submission to client
- [ ] Milestone submitted in Upwork with handoff notes
- [ ] Demo / walkthrough delivered (call or async)
- [ ] Approval received
- [ ] Payment released
```

### Status definitions

- **Not started:** no code or design work has begun
- **In progress:** active development, not yet feature-complete
- **In review:** feature-complete, in QA / verification
- **Awaiting client review:** submitted to client, awaiting approval
- **Approved:** client has approved, milestone closed

### Update cadence

Update the milestone scorecard:

- After each focused work session (a few sentences in "Notes")
- After every significant integration point (e.g., when a module crosses module-DoD)
- Before each weekly client call
- When status changes (one of the major transitions above)

---

## Weekly cadence

### Weekly recurring call with the client

**Day/time:** Thursday 5 PM Skopje (10 AM Chicago). Locked.

**Format:** 30-45 minutes on Zoom. Steve hosts and records.

**Standard agenda template:**

```
1. Status recap (5 min)
   - What shipped this week
   - What's in progress
   - Anything blocked

2. Demo of new functionality (10-15 min)
   - Run-through of completed modules
   - Walk through any new screens or flows

3. Client questions and feedback (10 min)
   - Open the floor

4. Next week's focus (5 min)
   - What's planned for the coming week
   - Any inputs needed from client

5. Open items and decisions (5 min)
   - Walk the decision log
   - Confirm or close out open questions
```

Bring to every call:

- Live deploy URL (test in private window before call)
- Latest staging + production Supabase dashboards
- Updated proposal page URL (only mention if changes happened)
- Notebook for capturing his asks

### Mid-week async check-in

Optional but recommended: a brief written update mid-week (Tuesday or Wednesday) via Slack with:

- What shipped since the last call
- What you're working on now
- Anything blocking
- Anything needed from him

This keeps the Thursday call focused on substantive discussion rather than status updates.

### Internal weekly cadence

Even though it's a one-developer project right now, run yourself a personal weekly retrospective:

- What did I ship this week?
- What didn't I ship that I planned to? Why?
- What's the most important thing for next week?
- Am I on track for the milestone target date? Adjust if not.
- Any new risks that emerged?

---

## Client call preparation

A successful call needs preparation. The level of prep depends on what's happening that week.

### Standard weekly call prep checklist (30 minutes before)

- [ ] Live deploy URL works (verify in private window)
- [ ] Staging Supabase dashboard opens and recent activity is visible
- [ ] Production Supabase dashboard opens
- [ ] GitHub repo is in a presentable state (recent commits, no embarrassing WIP commits visible at the top)
- [ ] The week's work is summarized in 3-5 bullet points
- [ ] Open items list is reviewed and any "client-blocked" items are top-of-mind
- [ ] Excalidraw or Figma frames ready for any V1 design discussion
- [ ] Notebook open for capturing asks
- [ ] Camera and audio tested
- [ ] Quiet environment, water nearby

### Milestone demo call prep (2+ hours before)

- [ ] Full milestone acceptance gate checklist from QA_GUIDE.md verified
- [ ] Pre-recorded Loom of the demo if the live demo is complex (as backup or supplement)
- [ ] Browser tabs queued in order of demo flow
- [ ] Backup plan if anything breaks during the live demo (local dev as fallback)
- [ ] Handoff notes drafted for the milestone (what changed, where to find it, how to test it independently)
- [ ] Upwork milestone submission ready to send during or after the call

### Difficult conversation prep

If a conversation might be hard (scope creep request, missed deadline, technical disagreement):

- [ ] Frame the conversation in advance: what's the position you're taking, what's the rationale, what would be an acceptable compromise
- [ ] Bring data: timeline impact, scope clarification from proposal, evidence of where decisions came from
- [ ] Plan how to redirect from "what's wrong" to "what we're doing next"
- [ ] Stay focused on the project's success, not on being right

### Demo scripting (for milestone demos)

Open with agenda. Drive the meeting, don't make the client drive it.

```
"Here's what I want to cover today:
1. Demo of <milestone> end to end
2. Walk through any open items from the proposal
3. Talk about what's next
Maybe 30 minutes. Anything you want to add?"
```

Lead with the working flow. Show, then comment. Avoid narrating every click.

Pause and check in:

- "Any questions on this flow before I move on?"
- "Does that match what you had in mind?"

Close with a clear next step:

- "M2 kicks off Monday. First week I'll focus on X and Y. I'll have something to show by Thursday's call."

---

## Status reporting

### Reporting structure for the client

Steve doesn't want long written status reports. He prefers:

- Conversational updates on the weekly call
- Short async messages when there's something to share or ask
- Tangible demos over written progress descriptions

### What to communicate proactively

**Always share:**

- When a milestone is submitted for review
- When a milestone is approved
- Blockers that are client-side (something you need from him)
- Major design decisions you're about to make (give him the chance to weigh in before code lands)

**Share if substantive:**

- Discoveries or trade-offs that affect future work
- Suggestions for scope adjustments
- Risks that have materialized

**Don't bother with:**

- Daily progress lists
- Detailed code-level updates (he doesn't need them)
- Technical issues you can resolve yourself
- Long apologies for delays (be brief and forward-looking)

### Status message template (for async updates)

```
Hi Steve,

Quick update on <milestone or area>:

✓ Done this week: <bullets>
→ In progress: <bullets>
○ Up next: <bullets>

<Anything needed from you>

<Next checkpoint or call reference>

Thanks,
Blagojche
```

Keep it tight. Three to five lines per section.

### Status message template (for milestone submission)

```
Hi Steve,

<Milestone N> is complete and ready for your review.

What shipped:
- <bullet>
- <bullet>
- <bullet>

How to verify on your side:
1. <step>
2. <step>
3. <step>

Demo: <Loom URL or scheduled call time>

Handoff notes: <link to handoff doc>

Submitted via Upwork: <milestone link>

Let me know if anything needs adjustment before approval.

Thanks,
Blagojche
```

---

## Risk register

Track risks throughout the project. Review and update at least weekly.

### Risk template

```
**Risk:** <one-line description>
**Likelihood:** Low / Medium / High
**Impact:** Low / Medium / High
**Mitigation:** <what we're doing to reduce likelihood or impact>
**Owner:** <who's responsible for tracking>
**Status:** Open / Mitigated / Triggered / Closed
```

### Initial risks for this project

**Content readiness lag**

- **Likelihood:** Medium
- **Impact:** High (affects M1 demo and M2 testing)
- **Mitigation:** Schema spec is delivered early; client authors content in parallel with M1-M2 development. Sample content is in place for testing without final client content. Flag early if content isn't progressing.
- **Owner:** Client (Steve)
- **Status:** Open

**Design ambiguity for novel screens**

- **Likelihood:** Medium
- **Impact:** Medium (could cause rework if direction shifts mid-build)
- **Mitigation:** Iterative design loops with Excalidraw/Figma mocks before code lands. Client signs off on each screen before build.
- **Owner:** Developer
- **Status:** Open

**Avatar artwork delivery delay**

- **Likelihood:** Medium (designer dependency)
- **Impact:** Low (placeholders work fine until artwork arrives; integration is fast)
- **Mitigation:** Use placeholder avatars in M1; integrate final artwork as a polish pass when delivered.
- **Owner:** Client
- **Status:** Open

**GoHighLevel webhook reliability**

- **Likelihood:** Low (standard Stripe-backed setup confirmed)
- **Impact:** Medium (CRM sync could lag)
- **Mitigation:** Implement retry with exponential backoff. Log all sync events. Manual reconciliation tooling if needed.
- **Owner:** Developer
- **Status:** Open

**iOS PWA limitations affecting push**

- **Likelihood:** Medium (iOS PWA push has known constraints)
- **Impact:** Medium (push reminders are M4 feature)
- **Mitigation:** Confirmed iOS 16.4+ supports installed PWA push. Document limitations clearly. Provide fallback (email notifications) as Plan B for affected users.
- **Owner:** Developer
- **Status:** Open

**Scope creep on member-facing UX**

- **Likelihood:** High (it's a new product; design instincts evolve)
- **Impact:** Medium (timeline pressure if unchecked)
- **Mitigation:** Anchor every new UI request against the V1 Feature Checklist. New ideas that aren't on the checklist go to a "V2 backlog" file, not into V1. Honest conversation if scope expands materially.
- **Owner:** Developer + Client
- **Status:** Open

**Production database accident**

- **Likelihood:** Low (staging-first policy in place)
- **Impact:** Critical
- **Mitigation:** Never run destructive operations against production. Always link to staging first. CLI shows current linked project; verify before destructive commands. Daily backups on Supabase Pro plan.
- **Owner:** Developer
- **Status:** Open

**Client travel or unavailability mid-milestone**

- **Likelihood:** Low to Medium
- **Impact:** Low (work can continue on areas not needing client input)
- **Mitigation:** Prioritize client-input-dependent work early in a milestone. Have async fallback (Loom + written notes) for review if a call slips.
- **Owner:** Developer
- **Status:** Open

Add new risks to the register as they emerge. Close risks that are no longer relevant. Mark risks as "Triggered" if they actually happen and require active management.

---

## Decision log

Decisions made during the project should be documented so future-you (or other devs) doesn't re-debate them.

### Decision template

```
## Decision: <one-line summary>

**Date:** <YYYY-MM-DD>
**Status:** Decided / Revisited / Reversed

**Context:**
<What was the situation that required a decision>

**Options considered:**
1. Option A: <description, pros, cons>
2. Option B: <description, pros, cons>
3. ...

**Decision:**
<Which option was chosen>

**Rationale:**
<Why this option was the right choice>

**Consequences:**
<What this decision implies, what we're committing to, what we're foregoing>

**Revisit if:**
<Conditions that would make us re-open this decision>
```

### Decisions already made for V1 (seed entries)

**Decision: Two separate Supabase projects for staging and production**

- Date: <during proposal>
- Status: Decided
- Rationale: Complete isolation between content preview and live members. Eliminates entire classes of accidental data crossover. Slight operational overhead (two projects to manage) is far outweighed by safety.
- Revisit if: scale or cost considerations make consolidation attractive (extremely unlikely)

**Decision: Functional-first design approach with iterative mocks**

- Date: <Friday June 12 design discussion>
- Status: Decided
- Rationale: One-developer build with content-heavy app. Full design-first waterfall is wrong for this scope. Iterative loops with Excalidraw mocks before each meaningful screen give client visibility without slowing the build.
- Revisit if: scale changes (e.g., adding designer to the team)

**Decision: Single content pipeline (content_type discriminator)**

- Date: <post-call alignment>
- Status: Decided
- Rationale: Lessons, Tips, References, Path nodes all need the same validate → stage → publish → rollback flow. Building per-type pipelines would be wasteful. Generalization in M2.
- Revisit if: a content type has truly different lifecycle needs (none anticipated)

**Decision: Player type identifiers are a strict closed enum**

- Date: <June 12 naming lock>
- Status: Decided
- Rationale: The six player types are the heart of the methodology and a closed set. Strict enum validation catches Claude-generated typos immediately, which is critical for the bulk content workflow.
- Revisit if: client decides to add a 7th player type (likely require a migration)

**Decision: Concepts are an open string field, not an enum**

- Date: <June 12 naming lock>
- Status: Decided
- Rationale: Client explicitly wants to extend the concept taxonomy through the CMS as he authors content. Open field gives him flexibility; the schema doc starts with 20 seed values.
- Revisit if: drift in concept naming becomes a real problem (could add taxonomy-management tooling in V2)

Add new decisions as they're made. Reference decisions from commit messages or PR descriptions when relevant ("Implements decision <name>").

---

## Change management

### When the client requests a change

1. **Acknowledge.** Confirm you heard the request accurately.
2. **Assess.** Determine: is this clarification (already in scope), enhancement (in spirit but not yet specified), or change (out of scope)?
3. **Respond.**
   - **Clarification:** confirm what's already in scope and proceed.
   - **Enhancement:** absorb if small (one-line scope addition); discuss if material (more than a few hours of work).
   - **Change:** scope conversation. Explicitly discuss timeline and pricing impact.
4. **Document.** Add a decision log entry if the change affects multiple decisions. Update the proposal if pricing or scope changes.

### Change framing template

For a scope change conversation:

```
"What you're describing is <slightly | meaningfully> beyond what's in the V1 proposal.

What we currently have in scope: <reference>

What you're describing additionally: <restate the new ask>

Two options:
1. Absorb it into the current milestone. Tradeoff: <timeline impact, focus impact>
2. Add it as a separate item with its own timeline and budget. Tradeoff: <delayed delivery, additional cost>

What works better for you?"
```

This gives the client agency and avoids the developer being either too generous (giving away free work) or too rigid (saying no to reasonable requests).

### Change types and default handling

| Type                            | Example                                                      | Default handling                                        |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Clarification of existing scope | "Wait, the validator should show 4 errors, not all of them?" | Confirm and proceed                                     |
| Small enhancement               | "Could the error panel have a copy-to-clipboard button?"     | Absorb if < 1 hour                                      |
| Medium enhancement              | "Add a search bar to the references library"                 | Discuss; usually absorb in current milestone if it fits |
| Significant addition            | "Add a leaderboard for daily streaks"                        | Scope conversation                                      |
| Out-of-scope feature            | "Add a discussion forum"                                     | Add to V2 backlog; not in V1                            |

---

## Acceptance signoff workflow

### Per-task signoff (informal)

Tasks are signed off internally by passing the task-level Definition of Done from QA_GUIDE.md. No client signoff needed for individual tasks.

### Per-module signoff (informal to formal)

Modules are signed off internally by passing the module-level Definition of Done. For modules with significant client-visible behavior, share a brief Loom or screenshot in Slack: "Wrapping up the glossary drawer. Quick preview here: <link>. Let me know if anything looks off; otherwise marking it done."

### Per-milestone signoff (formal)

Milestones require formal client approval via Upwork.

**Process:**

1. Developer completes the milestone acceptance gate checklist
2. Developer drafts handoff notes (what shipped, how to test, where to find things)
3. Developer prepares a demo (live or Loom)
4. Developer submits the milestone for approval in Upwork with the handoff notes
5. Demo is delivered (during weekly call or via async Loom)
6. Client reviews on their side; runs through verification steps independently
7. Client approves the milestone in Upwork
8. Payment is released; milestone is officially closed
9. Next milestone is funded and kicked off

If the client raises issues during review:

- Acknowledge the issue
- Categorize: is it a real defect, a scope clarification, or a new request?
- For defects: fix and re-submit
- For scope clarifications: discuss and align before deciding on a fix
- For new requests: change management workflow above

### Handoff notes template

```
# Milestone N Handoff

**Submitted:** <date>
**Scope:** <one-line summary>

## What shipped
- <feature>: <where to find it>
- <feature>: <where to find it>

## How to verify
1. Go to <URL>
2. Sign in (if needed) with <test account>
3. Navigate to <path>
4. Confirm <behavior>

## What's deferred to later milestones
- <item>: target M<n>

## Known issues (if any)
- <item>: <severity>, planned fix in M<n>

## Documentation updated
- <link to specific docs>

## Next milestone
M<n+1> begins <date>. First focus: <area>.
```

---

## Stakeholder map and communication preferences

### Primary client: Steve Pavilanis (Bushwood Digital Inc.)

- **Role:** Founder, product owner, content author
- **Background:** Former QA engineer (25 years), values process rigor
- **Communication style:** Detailed, structured, prefers Loom video over long text for explanations
- **Channels:**
  - Upwork: for milestone-related and contractual communication
  - Slack: for day-to-day async (channel set up after the first call)
  - Zoom: weekly call (Thursday 5 PM Skopje)
  - Loom: for design walkthroughs and async explanations
- **Decision style:** Wants to understand before approving. Asks specific questions. Appreciates options laid out clearly.
- **Quirks:**
  - Values plain-language explanations over jargon
  - Likes to verify things independently (hence Supabase dashboard access)
  - Doesn't write code himself but will have US developer friends review at points
  - Prefers no em dashes in his messages (mirror this in replies)

### Steve's developer friends (in the US)

- **Role:** Informal technical reviewers; Steve mentioned they'd check in on the code
- **Visibility:** They have GitHub access via the repo collaborator setup
- **What they'll look at:** code quality, architecture decisions, security
- **How to handle:** be ready for code-review questions. Write CLAUDE.md-compliant code. Have justifications for architecture decisions documented.

### Designer (TBD, hired by Steve)

- **Role:** Creates the 6 player-type avatars and brand assets
- **Communication:** Through Steve, not direct
- **What they need:** the design specs already documented (avatar formats, sizes, style guidance)
- **What they deliver:** SVG avatars and brand assets to be integrated into the app

### Future stakeholders (V2)

- Additional developers if scope expands
- Additional content authors if team grows
- Marketing or content team for the broader Beat Small Stakes brand

---

## Quality bar

Internal standards for what "good enough to ship" looks like. Steve is a QA engineer; the bar is high.

### Code quality

- TypeScript strict mode, no `any`
- All inputs validated via Zod
- Error handling on every async call
- Comments only where the why is non-obvious (not what)
- Component files are small (under 150 lines)
- Functions are focused (under 30 lines is typical)
- No commented-out code in commits
- No console.log left in production code

### UX quality

- No unexpected behavior (clicks always have a visible result)
- No broken states (every error has a clear message; no white screens)
- Loading states for any operation over 200ms
- Mobile-first design (test 360px first)
- Touch targets at least 44x44 pixels
- All interactive elements keyboard accessible
- No reliance on color alone to convey state

### Content quality

- Validator error messages read like a tester wrote them
- Documentation is current and matches the code
- Sample content is realistic, not Lorem Ipsum
- Schema doc is paste-ready into Claude

### Operational quality

- Every release has been smoke-tested in staging first
- Migrations applied to staging before production
- Rollback procedure tested at least once per milestone
- Backups verified periodically

---

## Forward-looking dependencies

Things to keep visibility on as the project progresses.

### From the client (Steve)

| Item                                                   | When needed                                         | Status                                              |
| ------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------- |
| Stripe account access (test + live keys)               | M3 start                                            | Pending                                             |
| GoHighLevel account / API access                       | M3 start                                            | Confirmed standard Stripe-backed                    |
| Supabase access for production                         | M3 start (or earlier for verification)              | Invites sent for staging + prod                     |
| Vercel + domain access                                 | M4 deploy (or earlier for staging custom subdomain) | Pending                                             |
| Custom domain registered                               | M4                                                  | Pending                                             |
| Email sender (transactional email service) credentials | M3 (for password resets)                            | Pending                                             |
| 6 player-type avatar artwork                           | M4 polish                                           | Pending (designer being hired)                      |
| Logo and brand assets (colors, fonts)                  | M4 polish (or earlier for design pass)              | Pending                                             |
| Content for M1 demo (sample lessons)                   | M1 demo                                             | Sample content created; final content lands ongoing |
| Content for production launch                          | Before launch                                       | Client authoring in parallel                        |
| Legal / IP agreement signed                            | Early in project                                    | Drafted by client                                   |

### From the developer (Blagojche)

| Item                                               | When       | Status      |
| -------------------------------------------------- | ---------- | ----------- |
| CLAUDE.md and code standards in repo               | Day 1      | Done        |
| Repo set up under client's GitHub                  | M1 kickoff | Done        |
| Supabase staging and prod projects                 | M1 kickoff | Done        |
| Test deliverable (validate-and-publish round trip) | Pre-M1     | Done        |
| Schema documentation                               | Pre-M1     | Done        |
| Developer guide                                    | Now        | In progress |
| QA guide                                           | Now        | In progress |
| DevOps guide                                       | Now        | In progress |
| Project management guide                           | Now        | In progress |
| Client dependencies list                           | Now        | In progress |

### From other parties

| Item                                          | Source                  | When                                  |
| --------------------------------------------- | ----------------------- | ------------------------------------- |
| Avatar SVGs                                   | Designer (via Steve)    | M4 polish; placeholders OK until then |
| Logo SVG and brand guide                      | Designer (via Steve)    | M4 polish                             |
| Email sender setup (DKIM, SPF, DMARC records) | Steve's domain provider | M3                                    |

---

## Appendix: a sample weekly PM ritual

A 30-minute Friday afternoon ritual to close the week and prep for the next:

1. **Review this week's progress (10 min):**
   - What shipped vs what was planned?
   - Any unexpected wins or losses?
   - Update the milestone scorecard.

2. **Update the risk register and decision log (5 min):**
   - Any new risks?
   - Any risks that escalated or de-escalated?
   - Any decisions made this week that should be logged?

3. **Plan next week (10 min):**
   - What's the most important thing to ship?
   - What's the second?
   - What can wait?
   - Any client inputs needed?

4. **Draft the weekly call agenda (5 min):**
   - 3-5 bullets of what to cover Thursday
   - Anything to demo specifically
   - Any decisions needed from the client

This ritual keeps the project organized without becoming busywork. Adjust the cadence as needed.
