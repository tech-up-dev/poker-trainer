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

**Last updated:** 2026-06-24

---

## 1. Snapshot

|                            |                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **Total V1**               | $16,250 fixed, 10–14 weeks @ 25–35 hrs/wk, 4 milestones                                         |
| **Paid test**              | ✅ Delivered & approved ($500, credited to M1)                                                  |
| **Current milestone**      | **M2 — Quiz Engine + CMS Backbone + Tips/References** ($5,850) — in progress, backend-first     |
| **Working repo**           | `tech-up-dev/poker-trainer` (mine). `dev` → Vercel Preview, `master` → Production               |
| **Client mirror**          | `beatsmallstakes/beat-small-stakes-app` (Steve's) — commits/PRs copied over later, approach TBD |
| **Live preview**           | https://poker-trainer-olive-rho.vercel.app                                                      |
| **Next client checkpoint** | Thursday 2026-06-25, 5 PM Skopje (recovery demo)                                                |

**Where we really are:** M1 backend is complete. M2 started 2026-06-24. Content pipeline
generalized to `content_*` tables with `content_type` discriminator. Admin auth gate live
(`REQUIRE_ADMIN=true`). Staging writes routed through `save-to-staging` Edge Function.
Member-facing UI (quiz engine, table, glossary) remains design-blocked.

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

**Goal:** "Visible, tangible product on screen by end of M1." $3,100 balance. Backend complete; member UI held pending design.

- [ ] Custom static 9-max table layout — _design-blocked_
- [ ] Lightweight card-rendering component — _design-blocked_
- [ ] MCQ interface — _design-blocked_
- [ ] Slide-up feedback drawer — _design-blocked_
- [ ] Tap-to-define glossary drawer — _design-blocked_
- [x] Bulk import flow: paste JSON batch → validate → save to staging
- [x] PWA scaffold: manifest, service worker, version-aware caching
- [x] Entitlements + auth schema (user_profiles, entitlements, answer_events)
- [x] Server-side re-validation in promote/rollback Edge Functions
- [x] Admin routing shell, login, route guard, RLS lockdown
- [x] Shared Zod schemas (lesson, tip, glossary, reference, path-node, content registry)
- [x] CI workflow (lint + build on PRs)
- [x] Seed admin user (staging + production)

### M2 — Quiz Engine + CMS Backbone + Tips/References — `In progress`

**Goal:** heaviest milestone; client becomes self-sufficient on content. $5,850.

- [ ] Quiz/lesson engine: sequencing, scoring, session completion, randomized order, review missed — _design-blocked_
- [ ] Starred/saved questions (persistent) — _design-blocked_
- [ ] Wizard authoring UI (branches by question type) — _design-blocked_
- [ ] Visual interactive table builder for hand scenarios — _design-blocked_
- [ ] Bulk import/export: CSV + Markdown parsers (JSON already works)
- [x] Zod validation engine with field-path-precise errors
- [x] Staging/prod isolation, write-to-staging preview, versioned publish, one-click rollback
- [x] **Content-type generalization**: `content_type` discriminator; `content_staging/published/versions`; one pipeline for all content types (2026-06-24)
- [x] Pipeline hardening: server-side re-validation ✓; admin auth gate (`REQUIRE_ADMIN=true`) ✓; CORS tightening ☐
- [ ] CORS tightening — Edge Functions still allow `*`; needs Vercel domain allow-list
- [x] Today's Tip + Saved Tips + References Library (+$750) — admin UI built: `/admin/tips` (TipEditor) + `/admin/references` (ReferenceEditor) + `get-from-staging` Edge Function (2026-06-24)
- [ ] Shared scenario data model — _design-blocked_

### M3 — Auth, Entitlements, Stripe, GHL Sync, Event Logging — `Not started`

$2,600.

- [ ] Supabase staging + prod schemas with RLS
- [ ] Supabase Auth: password (immediate post-purchase login) + magic-link recovery
- [ ] Entitlements model live; app gates on entitlements, not subscription state
- [ ] Flexible price points → single binary access entitlement (no code change for new prices)
- [ ] Stripe recurring billing + webhooks; failed-payment & cancellation handling
- [ ] Real-time GHL sync via per-Stripe-event Edge Function
- [ ] Answer-event logging instrumentation
- [ ] _(conditional)_ GHL→app webhook handler if GHL processes payments natively (+$150–250)

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

| #   | Date          | Decision                                                                                                                                                        | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 2026-06-21    | **React guide is conventions-only; Supabase governs auth/HTTP/state.**                                                                                          | The V3 proposal's committed stack is Vite + React + TS + Tailwind + Zod + Supabase only — no axios, .NET, TanStack Query, or Zustand. The REACT_FEATURE_IMPLEMENTATION_GUIDE is a generic master-prompt ported from an Angular/.NET project; its auth (`/api/v1/...` JWT) and mandated state/HTTP libraries do **not** apply. Follow it for typing, folder structure, component design, Tailwind/UI standards, forms, error handling, testing, security. Where it covers auth/data/state, SUPABASE_IMPLEMENTATION_GUIDE + DEVELOPER_GUIDE win. |
| D2  | (proposal)    | Two separate Supabase projects (staging + prod).                                                                                                                | Complete isolation of preview vs live members.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D3  | (proposal)    | Single content pipeline with `content_type` discriminator.                                                                                                      | One validate→stage→publish→rollback for all content types.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D4  | (naming lock) | Player types = strict closed enum (OMC/PLF/Y2K/GTO/DWM/STP); concepts = open field.                                                                             | Catch AI-generated typos on player types; let client extend concept taxonomy via CMS.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D5  | 2026-06-21    | **Add `react-router-dom`** for the member app.                                                                                                                  | Standard, unavoidable for multi-screen member app; client approved the dependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D6  | 2026-06-21    | **Backend-first for M1; member-facing UI held until design.**                                                                                                   | No approved member design yet (client sending ideas ~within a week). Build DB, schemas, Edge Functions, admin tooling, PWA/infra now; static table can be built headless on request.                                                                                                                                                                                                                                                                                                                                                           |
| D7  | 2026-06-21    | **One feature = one branch = one PR; app and API as separate PRs. No Claude attribution in commits/PRs; human-style code comments.**                            | Client's preferred workflow and house style.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D8  | 2026-06-21    | **Two-repo setup:** `tech-up-dev/poker-trainer` is the working repo; `beatsmallstakes/beat-small-stakes-app` is the client mirror, synced later (approach TBD). | Keeps working history separate; client copy handled deliberately when the time comes.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

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

| Item                                             | Lands in | Status                                    |
| ------------------------------------------------ | -------- | ----------------------------------------- |
| Server-side re-validation (Zod in Edge Function) | M2       | ✅ Done 2026-06-24                        |
| Admin auth on the validator                      | M2       | ✅ Done 2026-06-24 (`REQUIRE_ADMIN=true`) |
| Bulk-import file upload (client's main workflow) | M1       | JSON done; CSV/Markdown pending           |
| CORS tightening to Vercel domains                | M2       | Pending                                   |

## 7. Risks (live)

| Risk                                     | L/I        | Mitigation                                                  | Status |
| ---------------------------------------- | ---------- | ----------------------------------------------------------- | ------ |
| Content readiness lag (client authoring) | M/H        | Schema spec delivered; sample content for testing           | Open   |
| Design ambiguity on novel screens        | M/M        | Iterative mocks before build; member UI held until design   | Open   |
| Scope creep on member UX                 | H/M        | Anchor every ask to V1 checklist; V2 backlog for the rest   | Open   |
| iOS PWA push limits                      | M/M        | iOS 16.4+ supported; email fallback                         | Open   |
| Production DB accident                   | L/Critical | Staging-first; verify linked project before destructive ops | Open   |

## 8. Next actions

1. **CORS tightening** — replace `*` in Edge Function CORS headers with explicit Vercel + localhost allow-list (deferred to pre-production).
2. **CSV + Markdown bulk import parsers** — extend the existing bulk import UI to accept `.csv` and `.md` files in addition to JSON paste.
3. **Member-facing UI** — quiz engine, table, feedback drawer, glossary drawer — held pending design from Steve.
4. **Rotate admin credentials** before any client demo — `admin@domain.com` placeholder and `Administrator1!` must be replaced on both staging and production.
