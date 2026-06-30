# Project Brief — Beat Small Stakes Poker Trainer

> **Purpose.** Single-source briefing for Claude Code sessions and any human collaborator joining the project. Captures the client, the product, the commercial terms, the locked decisions, and the current state. Read this first; then read [CLAUDE.md](../CLAUDE.md) for code standards.
>
> **Authority.** When this document conflicts with stale chat memory, this document wins. When this document conflicts with the client's PRD (`Beat Small Stakes Poker Training App - PRD.pdf`), the PRD wins for product scope; this brief wins for commercial terms and engineering plan.

---

## 1. Client

| Field                                   | Value                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Client name**                         | Steve Pavilanis                                                                                                                 |
| **Legal entity (contracting party)**    | Bushwood Digital Inc.                                                                                                           |
| **Client email**                        | steve@bushwooddigital.com                                                                                                       |
| **Originally addressed to (corrected)** | Alpen Publishing Company → Bushwood Digital Inc.                                                                                |
| **Client background**                   | Former QA engineer. Spec-driven, appreciates discipline. Has US-based developer friends auditing the work.                      |
| **Communication style**                 | Heavy use of Loom videos for context-rich messages. Expects mid-build progress notes. Records Zoom calls and shares recordings. |
| **GitHub**                              | https://github.com/beatsmallstakes/beat-small-stakes-app (collaborator access pending push)                                     |
| **Recurring meeting**                   | Thursday 5:00 PM Skopje time (10:00 AM client time). Steve hosts on Zoom; flexible to reschedule.                               |

---

## 2. Product

**One-liner.** Beat Small Stakes is a mobile-first PWA that teaches poker strategy through interactive, flashcard-style quizzes — "Duolingo for poker." Subscription-gated, no app store.

**What it is NOT.** Not a hand simulator. Not a hand-replay tool. No card animations. No dynamic dealing. No deep branching decision trees. The 9-max poker tables that accompany scenario questions are **static snapshots**.

**Reference apps (client's words).**

- **Run It Out** — primary reference for flow, pacing, and the quiz-with-feedback-drawer format.
- **RailBird** — borrow the "Today's Spot" home-screen treatment and the prominent streak surface. _Not_ the 6-max playable-hand layout.

**Core member loop.**
Lesson intro → scenario-based quiz questions → instant feedback with teaching commentary → scoring and progress tracking.

**Distinguishing constraints.**

- **9-max full ring** tables only. Not 6-max. All nine seats must render cleanly on a phone screen.
- **Six locked player-type characters** (see §6) — central to the client's "Character Mapping" methodology and unique to his brand.
- **Branding must feel like the client's brand**, not a generic poker template.

---

## 3. Tech Stack (locked)

| Layer          | Choice                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend       | Vite + React + TypeScript + Tailwind                                                                                                            |
| Validation     | Zod (schemas live in `shared/schemas/`, types via `z.infer`)                                                                                    |
| Backend / Data | Supabase Cloud — Postgres + RLS + Auth + Edge Functions. **Separate projects for staging and production.**                                      |
| Payments       | Stripe recurring subscriptions. Multiple price points → single "app access" entitlement.                                                        |
| CRM            | GoHighLevel via Supabase Edge Function listening to **Stripe webhooks (real-time)**. Standard native Stripe-backed GHL integration (no Zapier). |
| Hosting        | Vercel. `dev` branch → Preview, `master` branch → Production.                                                                                   |
| Source control | GitHub. All deploys flow through GitHub → Vercel. No direct uploads.                                                                            |
| PWA            | Manifest + service worker from day one. iOS PWA limits acknowledged.                                                                            |

**New dependencies require explicit client confirmation before install.**

---

## 4. Commercial Terms

### 4.1 V1 Total

**$16,250** for V1. Timeline: **10–14 weeks at 25–35 focused hours/week**.

### 4.2 Milestones

| Milestone                          | Amount                                                | Scope (summary)                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paid Test** (credited toward M1) | $500 ✅ paid                                          | Validate-and-publish round trip: schema validation, write-to-staging, promote with versioning, one-click rollback, markdown schema doc for AI bulk generation.                                                                                                                                                                                                            |
| **M1 — Foundation + Member UI**    | $3,100 (M1 total $3,600, less $500 test) ✅ activated | Custom static 9-max table, card component, MCQ + slide-up feedback drawer, glossary drawer with nested linking, PWA scaffold, entitlements + auth schema. **"Visible, tangible product on screen by end of M1."**                                                                                                                                                         |
| **M2 — CMS Depth**                 | $5,850                                                | Wizard authoring UI; visual table builder for hand scenarios; bulk import (CSV/JSON/MD) with human-readable error messages; Today's Tip + Saved Tips + References/Library; starred/saved questions; pipeline extension so tips/references/path use the same validate→stage→publish→rollback; **server-side re-validation; admin auth on the validator; CORS tightening.** |
| **M3 — Stripe + GHL**              | $2,600                                                | Stripe checkout with immediate password set + login (no email wait); magic-link recovery; multi-price-point entitlements; real-time Stripe → Edge Function → GHL webhook sync; dual purchase path (GHL sales page also grants entitlement).                                                                                                                               |
| **M4 — Gamification + Polish**     | $4,200                                                | Path/Skills visual progression (Duolingo-style guided map); web push notifications (streak reminders, desktop + PWA); badge system with badge-decay/mastery-maintenance; monthly contest leaderboard (restored at client request); daily streak progress; onboarding flow + warm-up lesson; celebratory animations.                                                       |

### 4.3 Itemized M4 additions (negotiated)

These were added late and priced individually so the client could trade off:

| Item                                           | Price  | Lands in |
| ---------------------------------------------- | ------ | -------- |
| Path/Skills visual progression                 | $1,200 | M4       |
| Web push notifications (PWA, streak reminders) | $600   | M4       |
| Badge-decay / mastery-maintenance              | $400   | M4       |
| Today's Tip + Saved Tips + References/Library  | $750   | M2       |
| Onboarding + warm-up + celebratory animations  | $500   | M4       |
| Monthly contest leaderboard (restored)         | $350   | M4       |

Absorbed at no charge (refinements of existing scope):

- Nested glossary linking (refinement of M1 glossary).
- Starred/saved questions (extension of missed-question review).

### 4.4 Out of scope for V1 (intentionally deferred)

- AI features (adaptive recommendations, vector search). Schema is designed to support them additively in a future phase.
- Unified-dashboard cross-product login. Entitlements model designed so this is a V2 extension, not a rebuild.
- Native iOS/Android apps.

---

## 5. V1 Feature Checklist (single source of truth)

Locked against the client's PRD V1 Feature Checklist. Items grouped by milestone for delivery, but this is also the punch list for V1 acceptance.

**Foundation + Member UI (M1)**

- [ ] Custom static 9-max table (positions, stacks, dealer button, blinds, pot, board, hole cards), mobile-first
- [ ] Lightweight card-rendering component
- [ ] Multiple-choice question / answer interface (four answers, exactly one correct)
- [ ] Slide-up feedback drawer (correct/incorrect + teaching commentary)
- [ ] Tap-to-define glossary drawer with **nested linking** and navigation stack
- [ ] Installable PWA — manifest, service worker, caching strategy compatible with content versioning
- [ ] Entitlements + auth schema design (V2-ready)

**CMS Depth (M2)**

- [ ] Wizard authoring UI (branches by question type)
- [ ] Visual table builder for hand scenarios (place players, assign types, set stacks, move button, set board)
- [ ] Bulk import (CSV/JSON/Markdown) — Claude-friendly format
- [ ] Human-readable validation errors with field paths
- [ ] Staging preview before promote
- [ ] Versioned content + one-click rollback **for all content types** (not just lessons)
- [ ] Today's Tip + Saved Tips
- [ ] References / Library (cheat sheets, methodology, Character Mapping reference)
- [ ] Starred/saved questions (persistent)
- [ ] Server-side re-validation (deferred from test)
- [ ] Admin auth on the validator (deferred from test)
- [ ] CORS tightening to Vercel domains (deferred from test)
- [ ] Pipeline-consistency: tips, references, path nodes share the same validate→stage→publish→rollback model

**Payments + CRM (M3)**

- [ ] Stripe entitlements: multiple price points (e.g., $27/mo, $47/mo) → single "app access" entitlement, configurable in Stripe/GHL with no code changes
- [ ] Real-time Stripe webhook → Edge Function → GHL sync
- [ ] Dual purchase path: GHL sales page subscription creates the same Stripe entitlement
- [ ] In-app checkout grants immediate password + login (no email wait)
- [ ] Magic-link as secondary/recovery
- [ ] Two-layer rollback: Vercel for code (host-level), Supabase for content (versioned)

**Gamification + Polish (M4)**

- [ ] Path/Skills visual progression (Duolingo-style map, separate from stats dashboard)
- [ ] Web push notifications (streak reminders)
- [ ] Badge system with milestone badges AND badge-decay/mastery-maintenance
- [ ] Monthly contest leaderboard
- [ ] Daily streak progress
- [ ] Onboarding flow + warm-up lesson
- [ ] Celebratory animations
- [ ] Anticipated user-state model: saved tips, badges, streaks, points (no surprise bolt-on later)

---

## 6. Locked Content Names (committed `4dd584f`)

These are **frozen**. Schema fields populated with these identifiers.

**The 5 Controlled Chaos Principles**

1. Character Mapping
2. Strategic 3-Betting
3. Simple Math for Big Stacks
4. Floating and Equity Flow
5. Building and Winning Huge Pots

**The 6 Character Mapping player types (with short codes)**

1. Old Man Coffee (**OMC**)
2. Passive Loose Fish (**PLF**)
3. Y2K Tag (**Y2K**)
4. GTO Boy (**GTO**)
5. Drunk Whale Maniac (**DWM**)
6. Solid Thinking Player (**STP**)

**Concepts — open editable taxonomy** (added through CMS, not hardcoded). Seed list of 20:

3-Bet Sizing · Core 34 · 3-Betting Light · Value 3-Betting · Isolating Limpers · Building Table Image · Character Mapping · Implied Odds · Pot Odds · Equity Flow · Floating · Hand Reading · Value Betting · Bet Sizing · Pot Control · Blockers · In Position · Out of Position · Stack to Pot Ratio (SPR) · Continuation Betting · Table Image

_(Steve listed "19" twice — SPR and Continuation Betting. Both are seeded.)_

---

## 7. Architecture Decisions (locked)

### 7.1 Two-layer rollback

- **Code rollback** — Vercel one-click revert at the host level. Fixes a bad deploy.
- **Content rollback** — Supabase-backed versioned releases. Each "promote to production" creates a new content version; admin can revert to any prior good version instantly. Database is shared state outside the deployment, so Vercel rollback alone cannot recover from a bad content push.
- **Versioning covers all content types** (lessons, tips, references, glossary terms, path nodes), not just lessons.

### 7.2 Entitlements model (V2-ready)

- Users have zero or more **entitlements**, each mapped to a Stripe product/price.
- App authorizes by entitlement, not by "active subscription = access."
- Multiple Stripe price points (e.g., $27/mo, $47/mo, promos, annual) map to the **single "app access" entitlement** — configurable in Stripe/GHL with no code changes.
- Adding the client's Masterclass or any future product in V2 = new entitlement rows + a new Stripe product. No rebuild.
- Member-pricing handled with Stripe coupons tied to existing entitlements.
- Single Supabase Auth identity from day one.

### 7.3 AI-ready schema (no AI in V1)

- **Answer-event log** from day one — user, question, correct/incorrect, timestamp, time taken. Fuels future adaptive recommendations AND current stats/progress.
- **Stable IDs + rich tags** on all content (concept, principle, player type, street, difficulty) so future search and recommendations have signal.
- **pgvector available in Postgres** — embeddings and vector search are an additive layer, never a rebuild. No embeddings generated in V1.
- **AI-derived data lives in its own tables** so AI stays additive and never forces a change to source content.

### 7.4 Content pipeline (single shared model)

- Wizard authoring (M2), bulk import (M2), validator, member-app rendering, versioning, and rollback all read/write the **same shared schema in `shared/schemas/`**.
- Tips, References, Path nodes go through the **same** validate → stage → publish → rollback pipeline as lessons (Steve's explicit call-out in post-call summary).
- Glossary is **one managed glossary** feeding both in-drill tap-to-define and the standalone References Library view (no two parallel systems).

### 7.5 PWA + content publish interaction

- Service worker caching strategy is designed _together with_ the content publish flow so a "promote to production" always reaches members cleanly (no stale-content bug after publish).

### 7.6 Auth flow

- In-app purchase grants **immediate password set and login** — no email link required for first access.
- Magic-link available as a secondary / recovery path.
- Dual purchase path: a GHL sales-page subscription must create the **same** Stripe entitlement the app gates on, so it grants access automatically.

---

## 8. Deferred Items (tracked, do not let slip)

Four items were explicitly deferred from the paid test, with the client's confirmation they land in V1. None of these are "nice to have" — Steve listed each by name in his post-call summary and asked for confirmation they don't slip.

| Item                              | Lands in                                     | Notes                                                                                                 |
| --------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Server-side re-validation         | M2 (earliest M1 if time permits)             | Move Zod validation into the Edge Function so the client can't bypass it.                             |
| Admin auth on the validator       | M2                                           | Today the validator UI is public. Gate behind admin role.                                             |
| Bulk-import file upload           | M1 priority (client's main content workflow) | Steve targets **thousands of questions** generated via Claude. This is the workhorse, not the wizard. |
| CORS tightening on Edge Functions | M2                                           | Restrict to actual Vercel domains; today CORS is permissive.                                          |

---

## 9. Design / Asset Responsibilities

### 9.1 Client-supplied (Bushwood)

- Logo files
- Brand colors
- **6 player-type avatar illustrations** (one per character above). Static, simple, table-context. Delivered as ready-to-integrate files.
- App icon for PWA install (or a 512×512 master and dev generates the size set)
- Favicon set (or generated from master icon)
- 1200×630 social-share image
- Preferred typography (or dev picks complementary web fonts)
- Short voice/tone notes for UI microcopy

### 9.2 Dev-supplied

- Designer specs for player-type avatars (target resolution, format, transparency requirements)
- Technical defaults until brand assets arrive: clean type, generous spacing, careful contrast
- Final integration pass when brand assets land (typography, color system, spacing rhythm)

### 9.3 Design process (committed to client)

- Iterative design-and-build loops, NOT a single waterfall design phase.
- Per meaningful screen (dashboard, drill, table view, skills path, library): quick mock in Excalidraw/Figma → client reaction → adjust → build.
- Branding integration is its own deliberate pass once assets arrive.

---

## 10. Current State (as of 2026-06-21)

### 10.1 What's shipped

- Paid test ✅ delivered, approved, $500 released.
- Repo scaffold: Vite + React + TS + Tailwind + Supabase wired.
- Two Supabase projects (staging + production), migrations applied to both.
- Two Edge Functions deployed to production: `promote-to-prod`, `rollback-to-version`.
- Zod content schema in `shared/schemas/lesson.ts` matching V1 PRD: lessons, MCQ (4 answers, exactly 1 correct), hand scenarios with full table state, glossary, concepts, principle tags.
- Validator UI with field-path-specific error messages.
- Save-to-staging, promote-with-version-snapshot, append-only rollback (with custom confirmation modal).
- Published Content viewer (two-column layout: validator left, published right).
- Save/Promote double-fire guards.
- Naming lock applied: real principles, player-type codes, seed concepts.
- Markdown schema spec at `docs/schema-spec.md` (the doc Steve will paste into Claude for bulk generation).
- Live deploy: https://poker-trainer-olive-rho.vercel.app

### 10.2 What's active

- M2 line item on Upwork — labeled "M1 - Foundation, Static Table UI, Q&A Interface, Glossary (with nested linking), PWA Scaffold" — **activated at $3,100**.
- Current branch: `feat/promote-and-versioning`. Main branch: `master`.

### 10.3 Open coordination items

- Push everything to client's GitHub repo: https://github.com/beatsmallstakes/beat-small-stakes-app
- Send Supabase org invite to **steve@bushwooddigital.com**
- Send designer spec sheet for the 6 player-type avatars
- Client to draft and circulate a legal/IP agreement (standard ownership + non-resale-to-competitor terms)
- Client to set up Slack channel
- **Missed Thursday 2026-06-18 call — apology + visible-progress recovery in progress for Thursday 2026-06-25.**

### 10.4 Repo layout (current)

```
src/components/   ConfirmDialog · LessonValidator · PublishedContent · VersionsPanel
src/lib/          supabase · supabase-prod · validate
shared/schemas/   lesson.ts
supabase/migrations/  20260528005325_initial_schema.sql · 20260605000001_promote_and_versioning.sql
supabase/functions/   promote-to-prod · rollback-to-version
docs/             schema-spec.md · PROJECT_BRIEF.md (this file)
samples/          (sample lesson fixtures)
```

---

## 11. M1 Working Plan

Eight workstreams, ordered for visible progress first. None blocked on client assets.

1. **Static 9-max table layout** — placeholder avatar circles labeled with locked player codes (OMC/PLF/Y2K/GTO/DWM/STP). Mobile-first. The "screenshot" deliverable.
2. **Card rendering component** — suits + ranks, lightweight.
3. **MCQ + slide-up feedback drawer** — four answers, instant feedback, teaching commentary, wired to a real sample lesson.
4. **Glossary drawer with nested linking + navigation stack** — tap term → drawer → tap nested term → push → back pops.
5. **Entitlements + auth schema migration** — multi-price-point → single "app access" entitlement. V2-ready.
6. **PWA scaffold** — manifest, service worker with version-aware cache, install prompt, placeholder app icon (`TODO: replace with brand icon`).
7. **Server-side re-validation** — knock out the first deferred item early; move Zod check into Edge Function.
8. **Pipeline generalization stub** — at least one non-lesson content type (e.g., tips) flowing through the same validate→stage→publish→rollback to prove the architecture answer to Steve's call-out.

Suggested cadence:

- Mon–Tue: items 1–3 (visible UI, screenshot-ready)
- Wed AM: item 4
- Wed PM: progress note + Vercel preview link to Steve
- Thu: 5pm Skopje call, walk through 1–4 live
- Fri: items 5–7
- Following week: item 8 + polish

---

## 12. Operating Conventions (with this client)

- **Read [CLAUDE.md](../CLAUDE.md) first.** It is the code-standards source of truth.
- **Production-quality, not prototypes.** Every commit assumes the code carries forward.
- **No new dependencies without explicit confirmation.**
- **Migrations are immutable.** New migration file per change. Never edit existing ones. Apply to both staging and production via `supabase db push`.
- **Service-role keys stay in Supabase secrets.** Never in client code, Vercel env, or git.
- **Mid-build progress notes are standard practice with this client** — short, written, with a live preview link.
- **Thursday 5 PM Skopje is the recurring meeting slot.** Reschedule by message if needed; don't no-show.
- **When a prompt conflicts with this brief or with CLAUDE.md, raise the conflict before silently deviating.**

---

## 13. Useful Links

| Resource                           | URL                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Live preview                       | https://poker-trainer-olive-rho.vercel.app                                      |
| Client GitHub repo (target)        | https://github.com/beatsmallstakes/beat-small-stakes-app                        |
| Latest proposal                    | https://project-blueprint.vercel.app/proposals/poker-trainer-v3                 |
| PRD                                | `Beat Small Stakes Poker Training App - PRD.pdf` (client-supplied, not in repo) |
| Schema spec for AI bulk generation | [docs/schema-spec.md](./schema-spec.md)                                         |
| Code standards                     | [CLAUDE.md](../CLAUDE.md)                                                       |
