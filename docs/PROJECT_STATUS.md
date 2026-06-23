# Project Status — Beat Small Stakes Poker Trainer

> **Purpose.** Living tracker of execution progress against the four V1 milestones. This is
> the single place to see what's done, what's in flight, and what's next. Updated each work
> session as scope lands.
>
> **Sources of truth.** Product scope: [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) and the V3 proposal
> (`Poker Training & Quiz App — V3 Proposal`). Engineering reference:
> [poker-trainer-v3-dev-spec.html](./poker-trainer-v3-dev-spec.html),
> [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md),
> [SUPABASE_IMPLEMENTATION_GUIDE.md](./SUPABASE_IMPLEMENTATION_GUIDE.md),
> [REACT_FEATURE_IMPLEMENTATION_GUIDE.md](./REACT_FEATURE_IMPLEMENTATION_GUIDE.md). PM playbook:
> [PROJECT_MANAGEMENT.md](./PROJECT_MANAGEMENT.md).

**Last updated:** 2026-06-21

---

## 1. Snapshot

| | |
|---|---|
| **Total V1** | $16,250 fixed, 10–14 weeks @ 25–35 hrs/wk, 4 milestones |
| **Paid test** | ✅ Delivered & approved ($500, credited to M1) |
| **Current milestone** | **M1 — Foundation + Member UI** ($3,100 balance) — in progress, backend-first |
| **Working repo** | `tech-up-dev/poker-trainer` (mine). `dev` → Vercel Preview, `master` → Production |
| **Client mirror** | `beatsmallstakes/beat-small-stakes-app` (Steve's) — commits/PRs copied over later, approach TBD |
| **Live preview** | https://poker-trainer-olive-rho.vercel.app |
| **Next client checkpoint** | Thursday 2026-06-25, 5 PM Skopje (recovery demo) |

**Where we really are:** the paid-test pipeline (validator → save-to-staging → versioned
promote → rollback, plus published-content viewer) is shipped and carries into M1. No
member-facing UI exists yet. M1 backend foundation is underway.

---

## 2. Milestone scorecards

Status legend: `Not started` · `In progress` · `In review` · `Awaiting client` · `Approved`

### Paid test — ✅ Approved
Validate-and-publish round trip on a sample lesson. Code carries into M1.
- [x] Zod content schema (`shared/schemas/lesson.ts`) — lessons, MCQ (4 answers / exactly 1 correct), hand scenarios w/ table state, tags
- [x] Validator UI with field-path-specific errors (`LessonValidator.tsx`, `validate.ts`)
- [x] Save-to-staging
- [x] Versioned promote (`promote-to-prod` Edge Function)
- [x] Append-only rollback with confirm modal (`rollback-to-version`, `ConfirmDialog.tsx`)
- [x] Published Content viewer (`PublishedContent.tsx`, `VersionsPanel.tsx`)
- [x] Markdown schema spec for AI bulk generation (`docs/schema-spec.md`) — delivered to client 2026-06-21
- [x] Two Supabase projects (staging + prod), migrations applied to both

### M1 — Foundation, Static Table, Q&A, Glossary (nested), PWA Scaffold — `In progress`
**Goal:** "Visible, tangible product on screen by end of M1." $3,100 balance. Backend-first while member design is pending.
- [ ] Custom static 9-max table layout (positions, stacks, dealer button, blinds, pot, board, hole cards), mobile-first — *design-blocked*
- [ ] Lightweight card-rendering component (no animation) — *design-blocked*
- [ ] MCQ interface (four answers, exactly one correct) — *design-blocked*
- [ ] Slide-up feedback drawer (correct/incorrect + teaching commentary) — *design-blocked*
- [ ] Tap-to-define glossary drawer with nested linking + navigation stack — *design-blocked*
- [~] Bulk import flow: paste JSON batch → validate → save to staging (admin tool) — **in review, [PR #81](https://github.com/tech-up-dev/poker-trainer/pull/81)**
- [~] PWA scaffold: manifest, service worker, version-aware caching strategy — **in review, [PR #82](https://github.com/tech-up-dev/poker-trainer/pull/82)**
- [~] Entitlements + auth schema design (V2-ready) — **in review, [PR #76](https://github.com/tech-up-dev/poker-trainer/pull/76)**
- [~] *(early-pull)* Server-side re-validation in promote/rollback Edge Functions — **in review, [PR #79](https://github.com/tech-up-dev/poker-trainer/pull/79)**

**M1 supporting PRs (in review):**
- Shared content schemas (glossary/tip/reference/path-node + registry) — [PR #78](https://github.com/tech-up-dev/poker-trainer/pull/78)
- Admin routing shell (react-router) — bundled with [PR #81](https://github.com/tech-up-dev/poker-trainer/pull/81)
- Edge admin-auth gate + CORS allow-list (groundwork, flag-gated) — bundled with [PR #79](https://github.com/tech-up-dev/poker-trainer/pull/79)
- CI workflow (lint + build on PRs) — [PR #80](https://github.com/tech-up-dev/poker-trainer/pull/80)

### M2 — Quiz Engine + CMS Backbone + Tips/References — `Not started`
**Goal:** heaviest milestone; client becomes self-sufficient on content. $5,850.
- [ ] Quiz/lesson engine: sequencing, scoring, session completion, randomized order, review missed
- [ ] Starred/saved questions (persistent)
- [ ] Wizard authoring UI (branches by question type)
- [ ] Visual interactive table builder for hand scenarios
- [ ] Bulk import/export (CSV, JSON, Markdown) + paste-into-Claude markdown spec
- [ ] Zod validation engine with field-path-precise errors
- [ ] Staging/prod isolation, write-to-staging preview, versioned publish, one-click rollback
- [ ] **Content-type generalization**: `content_type` discriminator across staging/published/versions (rename to `content_*`); one pipeline for Lessons/Tips/References/Path nodes
- [ ] Pipeline hardening: server-side re-validation; admin auth gate on validator; CORS allow-list tightening
- [ ] Today's Tip + Saved Tips + References Library (+$750)
- [ ] Shared scenario data model across wizard, bulk upload, validator, member app

### M3 — Auth, Entitlements, Stripe, GHL Sync, Event Logging — `Not started`
$2,600.
- [ ] Supabase staging + prod schemas with RLS
- [ ] Supabase Auth: password (immediate post-purchase login) + magic-link recovery
- [ ] Entitlements model live; app gates on entitlements, not subscription state
- [ ] Flexible price points → single binary access entitlement (no code change for new prices)
- [ ] Stripe recurring billing + webhooks; failed-payment & cancellation handling
- [ ] Real-time GHL sync via per-Stripe-event Edge Function
- [ ] Answer-event logging instrumentation
- [ ] *(conditional)* GHL→app webhook handler if GHL processes payments natively (+$150–250)

### M4 — Skills Path, Streaks, Push, Badges, Onboarding, Leaderboard, QA, Deploy — `Not started`
$4,200.
- [ ] Skills Path / visual progression (Duolingo-style map; unlock states; dependencies) (+$1,200)
- [ ] Web push notifications (VAPID, scheduled send job) (+$600)
- [ ] Badge decay / mastery-maintenance (+$400)
- [ ] Onboarding + warm-up lesson + celebratory animations (+$500)
- [ ] Monthly contest leaderboard (+$350)
- [ ] Points/scoring + daily streak
- [ ] Achievement badges for milestones
- [ ] Progress tracking + richer stats dashboard
- [ ] Full QA (desktop + mobile), polish, deploy to client domain

---

## 3. Decision log (project-specific)

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| D1 | 2026-06-21 | **React guide is conventions-only; Supabase governs auth/HTTP/state.** | The V3 proposal's committed stack is Vite + React + TS + Tailwind + Zod + Supabase only — no axios, .NET, TanStack Query, or Zustand. The REACT_FEATURE_IMPLEMENTATION_GUIDE is a generic master-prompt ported from an Angular/.NET project; its auth (`/api/v1/...` JWT) and mandated state/HTTP libraries do **not** apply. Follow it for typing, folder structure, component design, Tailwind/UI standards, forms, error handling, testing, security. Where it covers auth/data/state, SUPABASE_IMPLEMENTATION_GUIDE + DEVELOPER_GUIDE win. |
| D2 | (proposal) | Two separate Supabase projects (staging + prod). | Complete isolation of preview vs live members. |
| D3 | (proposal) | Single content pipeline with `content_type` discriminator. | One validate→stage→publish→rollback for all content types. |
| D4 | (naming lock) | Player types = strict closed enum (OMC/PLF/Y2K/GTO/DWM/STP); concepts = open field. | Catch AI-generated typos on player types; let client extend concept taxonomy via CMS. |
| D5 | 2026-06-21 | **Add `react-router-dom`** for the member app. | Standard, unavoidable for multi-screen member app; client approved the dependency. |
| D6 | 2026-06-21 | **Backend-first for M1; member-facing UI held until design.** | No approved member design yet (client sending ideas ~within a week). Build DB, schemas, Edge Functions, admin tooling, PWA/infra now; static table can be built headless on request. |
| D7 | 2026-06-21 | **One feature = one branch = one PR; app and API as separate PRs. No Claude attribution in commits/PRs; human-style code comments.** | Client's preferred workflow and house style. |
| D8 | 2026-06-21 | **Two-repo setup:** `tech-up-dev/poker-trainer` is the working repo; `beatsmallstakes/beat-small-stakes-app` is the client mirror, synced later (approach TBD). | Keeps working history separate; client copy handled deliberately when the time comes. |

---

## 4. Dependency / stack posture

**Installed (matches proposal):** `react` 19, `react-dom`, `zod` 4, `@supabase/supabase-js`, `tailwindcss` 4, Vite, TypeScript.

**Approved to add:** `react-router-dom` (D5).

**Not planned for V1** (DEVELOPER_GUIDE: no global state lib / no TanStack in V1; Supabase replaces axios): TanStack Query, Zustand, axios. `react-hook-form` optional for CMS forms in M2 — confirm before adding.

---

## 5. Open coordination items (client-side)

- [ ] Real content sample (3–5 lessons + glossary terms) for data-model lock — unblocked now that `schema-spec.md` was sent
- [ ] Confirm Supabase projects under client org for billing; production to Pro plan before launch
- [ ] Legal/IP agreement (client to draft)
- [ ] Slack invite re-sent to j_baze@live.com
- [ ] Pre-kickoff access pending: Stripe (M3), Vercel + custom domain (M4), transactional email (M3)
- [x] schema-spec.md delivered to client (2026-06-21)
- [x] Recovery for missed 2026-06-18 call — message sent; Thursday 2026-06-25 confirmed

## 6. Deferred items tracker (do not let slip)

| Item | Lands in | Status |
|------|----------|--------|
| Server-side re-validation (Zod in Edge Function) | M2 (earliest M1) | Pending |
| Admin auth on the validator | M2 | Pending |
| Bulk-import file upload (client's main workflow) | M1 | Pending |
| CORS tightening to Vercel domains | M2 | Pending |

## 7. Risks (live)

| Risk | L/I | Mitigation | Status |
|------|-----|------------|--------|
| Content readiness lag (client authoring) | M/H | Schema spec delivered; sample content for testing | Open |
| Design ambiguity on novel screens | M/M | Iterative mocks before build; member UI held until design | Open |
| Scope creep on member UX | H/M | Anchor every ask to V1 checklist; V2 backlog for the rest | Open |
| iOS PWA push limits | M/M | iOS 16.4+ supported; email fallback | Open |
| Production DB accident | L/Critical | Staging-first; verify linked project before destructive ops | Open |

## 8. Next actions

1. Review/merge the open M1 PRs (#76–#82). All are conflict-free and can merge in any order.
2. Deploy steps after merge (need Supabase access): apply migration #76 to staging then prod (`supabase db push`); deploy the hardened Edge Functions #79 to staging (`supabase functions deploy`) to confirm the shared-schema import bundles under Deno.
3. Member-facing UI (static table, card, MCQ, feedback drawer, glossary drawer) remains held pending design direction.
4. Prepare the Thursday 2026-06-25 recovery demo with visible progress (bulk import + admin shell are demoable now).
