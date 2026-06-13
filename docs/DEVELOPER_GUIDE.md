# Developer Guide

Comprehensive technical reference for developers working on the Poker Trainer app. This is a content-heavy subscription PWA with a no-code content operations backbone. The codebase is one repo, but logically two workstreams: the member-facing app and the CMS pipeline.

For day-to-day code style and conventions, see `CLAUDE.md` at the repo root. This document complements it with deeper architecture, patterns, and how-to-extend guidance.

---

## Table of contents

1. [Mission and product context](#mission-and-product-context)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Tech stack reference](#tech-stack-reference)
4. [Repository structure](#repository-structure)
5. [Local development setup](#local-development-setup)
6. [Frontend architecture](#frontend-architecture)
7. [Backend architecture (Supabase)](#backend-architecture-supabase)
8. [Validation pattern (Zod, single source of truth)](#validation-pattern-zod-single-source-of-truth)
9. [The content pipeline](#the-content-pipeline)
10. [Authentication and entitlements](#authentication-and-entitlements)
11. [PWA and push notifications](#pwa-and-push-notifications)
12. [Branching, commits, and PRs](#branching-commits-and-prs)
13. [How to add a new content type](#how-to-add-a-new-content-type)
14. [How to add a new Edge Function](#how-to-add-a-new-edge-function)
15. [How to add a new React component](#how-to-add-a-new-react-component)
16. [How to add a database migration](#how-to-add-a-database-migration)
17. [Testing approach](#testing-approach)
18. [Common pitfalls](#common-pitfalls)

---

## Mission and product context

The Poker Trainer is a Duolingo-style learning experience built around the client's poker methodology (Controlled Chaos). Members work through scenario-based quiz questions with instant teaching feedback, earn streaks and badges, and progress through a guided Skills Path.

**Two workstreams that matter:**

1. **Member-facing app.** The quiz, the static 9-max poker table, the glossary drawer, the Skills Path, the dashboard, the tips library. Mobile-first PWA.
2. **Content Operations backbone (CMS).** The wizard-style authoring UI, the visual table builder, bulk import/export, the Zod validation engine, separate staging and production environments, versioning, and one-click rollback.

The CMS is the heaviest technical work in V1. It's the heart of the app. Content goes through the same pipeline (validate → stage → publish → rollback) regardless of type. Lessons, Tips, References, and Skills Path nodes all use the same machinery.

**Hard constraints:**

- 9-max poker table only. Never 6-max. This is non-negotiable.
- Static table layout. No card-dealing animations, no live-play simulation, no branching decision trees.
- All content is authored by the client. Developers build the pipeline, validator, and tools. Never the content.
- PWA only. No native mobile apps.

---

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│                      USER (browser, mobile PWA)                       │
└────────────────────────────┬──────────────────────────────────────────┘
                             │ HTTPS
              ┌──────────────▼───────────────┐
              │  Vercel (React app, static)  │
              │  Vite + React + TS + Tailwind │
              └──────────────┬───────────────┘
                             │
        ┌────────────────────┼────────────────────────┐
        │                    │                        │
┌───────▼─────────┐  ┌──────▼──────────┐    ┌────────▼─────────┐
│ Supabase        │  │ Supabase Edge   │    │ Stripe           │
│ (Production)    │  │ Functions       │    │ (recurring sub)  │
│                 │  │ - promote       │    │                  │
│ - Postgres      │  │ - rollback      │    └─────────┬────────┘
│ - Auth          │  │ - stripe-webhook│              │
│ - Storage       │  │ - ghl-webhook   │              │ webhook
│ - RLS policies  │  └────┬────────────┘              │
└─────────────────┘       │                ┌──────────▼────────┐
                          │                │ Supabase Edge Fn  │
                          │                │ (Stripe to GHL)   │
                          │                └─────────┬─────────┘
            ┌─────────────▼─────────────┐            │
            │ Supabase (Staging)        │            │
            │ - Same schema as Prod     │   ┌────────▼─────────┐
            │ - Used for content        │   │ GoHighLevel CRM  │
            │   preview before publish  │   └──────────────────┘
            └───────────────────────────┘
```

**Two Supabase projects** (staging and production) from day one. Content gets written to staging first, previewed, then promoted to production. Each promotion creates a version snapshot.

**Two-layer rollback:**
- Code rollback: Vercel's one-click deployment revert
- Content rollback: Supabase versioned publish (any prior version can be restored)

Code and content roll back independently. No coordination needed between them.

---

## Tech stack reference

| Layer | Technology | Why |
|-------|-----------|-----|
| Build tool | Vite | Fast dev server, fast builds, modern ESM |
| Framework | React 18+ | Standard for this type of app |
| Language | TypeScript (strict) | Schema-heavy app; type safety end to end |
| Styling | Tailwind CSS | Utility-first, fast to iterate, no custom CSS bloat |
| Validation | Zod | Schemas are the source of truth; types derived |
| State (local) | React `useState`, `useReducer` | No global state library in V1 |
| State (server) | Direct Supabase queries | No TanStack Query yet; add if needed in M2 |
| Routing | React Router (added M1) | Standard SPA routing |
| Database | Postgres (via Supabase) | Relational data, strong consistency, RLS |
| Auth | Supabase Auth | Password + magic link, integrated with RLS |
| Storage | Supabase Storage | For avatar artwork and any future media |
| Edge Functions | Supabase Edge Functions (Deno) | Server-side logic for promote, rollback, webhooks |
| Payments | Stripe (recurring billing) | Industry standard |
| CRM sync | GoHighLevel (via Stripe webhook) | Real-time, per-Stripe-event |
| PWA | Service Worker + Web Manifest | Add-to-home-screen, offline caching, web push |
| Push | Web Push API (VAPID) | iOS 16.4+ supported for installed PWAs |
| Hosting | Vercel | Code deploys, instant rollback, branch previews |
| Source control | GitHub | Repo lives under the client's account |

**Versions to pin:** see `package.json`. Notable: Zod v4 (the validation API uses `error` callbacks, not `errorMap`).

---

## Repository structure

```
/
├── CLAUDE.md                   # Code standards (read first, always)
├── README.md                   # Quick start, what this is
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.cjs
├── index.html
├── public/                     # Static assets served as-is
│   ├── manifest.json           # PWA manifest
│   └── service-worker.js       # Custom SW (added M1 PWA scaffold)
├── src/
│   ├── main.tsx                # Entry point, providers
│   ├── App.tsx                 # Root component, router
│   ├── index.css               # Tailwind directives only
│   ├── components/             # Reusable UI components, one per file
│   ├── pages/                  # Top-level page components (with routing)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility modules (supabase client, validators)
│   └── types/                  # Cross-cutting TypeScript types
├── shared/
│   └── schemas/                # Zod schemas — imported by app AND Edge Functions
│       ├── lesson.ts           # Lesson and Question schemas
│       ├── tip.ts              # Tip schema (added M2)
│       ├── reference.ts        # Reference schema (added M2)
│       ├── path-node.ts        # Skills Path node schema (added M2)
│       └── glossary.ts         # Glossary entry schema
├── supabase/
│   ├── config.toml             # Supabase CLI config
│   ├── migrations/             # SQL files, sequential timestamped
│   ├── functions/              # Edge Functions, one folder per function
│   │   ├── promote-to-prod/
│   │   ├── rollback-to-version/
│   │   ├── stripe-webhook/
│   │   └── ghl-sync/
│   └── seed.sql                # Optional seed data for local dev
├── docs/
│   ├── schema-spec.md          # Canonical content schema for Claude bulk gen
│   ├── build-prompts.md        # Chronological build log (Claude Code prompts)
│   ├── DEVELOPER_GUIDE.md      # This file
│   ├── QA_GUIDE.md
│   ├── DEVOPS_GUIDE.md
│   ├── PROJECT_MANAGEMENT.md
│   └── CLIENT_DEPENDENCIES.md
└── samples/                    # Sample content fixtures for the validator
```

**Conventions:**

- `shared/` is the only place code is shared between the React app and Edge Functions. Never put React-specific imports (JSX, hooks) in `shared/`.
- One component per file. Filename matches the component name in PascalCase.
- Utilities in `lib/` are kebab-case (`validate.ts`, `supabase.ts`, `format-path.ts`).
- Edge Function folders are kebab-case (`promote-to-prod/`). The folder name becomes the URL path.

---

## Local development setup

### Prerequisites

- Node.js 20+ (LTS)
- npm or pnpm
- Supabase CLI (for migrations and Edge Function deployment)
- Git
- A modern browser (Chrome, Firefox, Safari, Edge)

### First-time setup

```bash
# Clone the repo
git clone https://github.com/beatsmallstakes/beat-small-stakes-app.git
cd beat-small-stakes-app

# Install dependencies
npm install

# Copy the env template
cp .env.example .env.local
```

Fill in `.env.local` with:

```
VITE_SUPABASE_URL=<staging Supabase URL>
VITE_SUPABASE_ANON_KEY=<staging Supabase anon key>
```

For production builds, Vercel injects production env vars at build time. Never put production keys in your local `.env.local`.

### Running the app

```bash
npm run dev          # Dev server on http://localhost:5173
npm run build        # Production build to dist/
npm run preview      # Serve the production build locally
npm run lint         # ESLint
npm run typecheck    # TypeScript check without emitting
```

### Working with Supabase locally

The development workflow uses the **staging** Supabase project directly, not a local Postgres instance. This keeps the schema in sync with what the team sees in the dashboard.

```bash
# Link the CLI to a project (one-time, per environment)
supabase login
supabase link --project-ref <staging-project-ref>

# Apply migrations to the linked project
supabase db push

# Deploy an Edge Function to the linked project
supabase functions deploy <function-name>

# Set Edge Function secrets
supabase secrets set KEY=value
```

To switch contexts to the production project, re-link:

```bash
supabase link --project-ref <prod-project-ref>
```

The CLI tracks the current linked project in `supabase/.temp/project-ref`. Always confirm which environment you're targeting before running destructive operations.

---

## Frontend architecture

### Routing structure (added in M1)

```
/                    → Home/dashboard (member-facing)
/drill/:lessonId     → Active drill session
/library             → References Library and Saved Tips
/glossary            → Standalone glossary browser
/profile             → Subscription, settings, logout
/admin/validator     → Validation UI (admin-only, M2 auth gated)
/admin/wizard        → CMS wizard authoring (M2)
/admin/versions      → Versioned content management, rollback (M2)
/onboarding          → First-login flow (M4)
```

All `/admin/*` routes are gated by an admin entitlement check (added in M2). Before that, the validator UI is publicly reachable in dev/test environments.

### Component categorization

**Presentational components** (`src/components/`): receive props, render UI, no data fetching. Examples: `Button`, `Drawer`, `PokerTable`, `QuestionCard`.

**Page components** (`src/pages/`): correspond to routes. Handle data fetching, compose presentational components. Examples: `DrillPage`, `DashboardPage`, `ValidatorPage`.

**Domain components** (`src/components/`, grouped logically): related to a feature area. Examples: `quiz/QuestionRenderer.tsx`, `glossary/GlossaryDrawer.tsx`, `table/StaticPokerTable.tsx`.

### State management strategy

Local component state via `useState` and `useReducer`. No global state library in V1.

Server state (Supabase queries) is fetched in `useEffect` or event handlers. If complexity grows in M2 (caching, refetching), consider adding TanStack Query — that's a decision point, not a default.

For session-wide state (current user, entitlements), use React Context. One provider at the app root: `AuthProvider` exposing the current Supabase session and the user's entitlement set.

### Styling conventions

- Tailwind utilities first. No custom CSS outside `index.css` (which is just `@import "tailwindcss"`).
- Extract a component when the markup repeats 3+ times or has its own behavior.
- Don't write `@apply` directives in custom CSS. Use utility classes in JSX.
- Dark mode: not in V1. The app uses a single light scheme until V2.
- Mobile-first: design every screen for the smallest viewport (around 360px) first, then expand for larger screens with Tailwind responsive prefixes (`sm:`, `md:`, `lg:`).

### Component anatomy example

```tsx
// src/components/quiz/QuestionRenderer.tsx
import { useState } from "react";
import type { Question, Answer } from "@/types/lesson";
import { FeedbackDrawer } from "./FeedbackDrawer";

type QuestionRendererProps = {
  question: Question;
  onAnswered: (answer: Answer, isCorrect: boolean) => void;
};

export function QuestionRenderer({ question, onAnswered }: QuestionRendererProps) {
  const [selected, setSelected] = useState<Answer | null>(null);

  function handleSelect(answer: Answer) {
    setSelected(answer);
    onAnswered(answer, answer.is_correct);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h2 className="text-xl font-semibold mb-4">{question.prompt}</h2>
      <div className="space-y-3">
        {question.answers.map((answer, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(answer)}
            disabled={selected !== null}
            className="w-full p-4 text-left rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            {answer.text}
          </button>
        ))}
      </div>
      {selected && (
        <FeedbackDrawer answer={selected} isCorrect={selected.is_correct} />
      )}
    </div>
  );
}
```

Key patterns visible:
- Props as a `type` alias (not `interface`)
- Hooks at top of component
- Event handlers as named functions inside the component
- No premature memoization
- Tailwind utilities for all styling

---

## Backend architecture (Supabase)

### Postgres schema overview

Tables are organized around content types and user state.

**Content tables** (per content type, post-M2 generalization):

```sql
content_staging (
  content_id text primary key,
  content_type text not null,  -- 'lesson' | 'tip' | 'reference' | 'path_node'
  content jsonb not null,
  updated_at timestamptz not null default now()
)

content_published (
  content_id text primary key,
  content_type text not null,
  content jsonb not null,
  current_version int not null,
  updated_at timestamptz not null default now()
)

content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  content_type text not null,
  version_number int not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  created_by text,  -- 'promote' | 'rollback' | user_id for manual edits
  source_version int,  -- for rollbacks, points to the version restored
  unique (content_id, version_number)
)
```

**Glossary table** (single managed table feeding both in-drill drawer and Library):

```sql
glossary_entries (
  term_id text primary key,
  term text not null,
  definition text not null,
  importance text,  -- 'core' | 'reference' | etc.
  example text,
  usage text,
  related_terms text[]  -- term_ids of related glossary entries
)
```

**User state tables** (added M3-M4):

```sql
users (managed by Supabase Auth)

entitlements (
  user_id uuid references auth.users,
  entitlement_key text not null,  -- 'quiz_app_access' | future product keys
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  source text,  -- 'stripe_sub_<id>' | 'manual' | 'ghl_<id>'
  primary key (user_id, entitlement_key)
)

user_progress (
  user_id uuid references auth.users,
  lesson_id text not null,
  questions_answered int default 0,
  questions_correct int default 0,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  primary key (user_id, lesson_id)
)

user_streaks (
  user_id uuid references auth.users primary key,
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date
)

user_saved_questions (
  user_id uuid references auth.users,
  question_id text not null,
  lesson_id text not null,
  saved_at timestamptz default now(),
  primary key (user_id, question_id)
)

user_saved_tips (user_id, tip_id, saved_at, primary key (user_id, tip_id))

user_badges (
  user_id uuid references auth.users,
  badge_key text not null,
  earned_at timestamptz default now(),
  decayed boolean default false,  -- for badge decay logic
  primary key (user_id, badge_key)
)

answer_events (
  id bigserial primary key,
  user_id uuid references auth.users,
  question_id text not null,
  lesson_id text not null,
  is_correct boolean not null,
  selected_answer int not null,
  time_taken_ms int,
  created_at timestamptz default now()
)
```

`answer_events` is append-only and powers progress stats plus future AI features. Never delete from this table.

### Row Level Security (RLS) policies

Every user-data table has RLS enabled. The default policy pattern:

```sql
-- Members can read their own data
create policy "Users read own progress" on user_progress
  for select using (auth.uid() = user_id);

-- Members can write their own data
create policy "Users update own progress" on user_progress
  for insert with check (auth.uid() = user_id);

-- Service role bypasses RLS (used by Edge Functions only)
```

Content tables (`content_staging`, `content_published`, `glossary_entries`):

```sql
-- All authenticated users can read published content (anonymous browsers cannot)
create policy "Authenticated read published" on content_published
  for select using (auth.role() = 'authenticated');

-- Only service role writes published content (via Edge Functions)
-- No public write policy
```

Staging is more permissive in dev/test (anon read) and admin-gated in production (M2).

### Edge Function inventory

| Function | Purpose | Hosted in | Auth |
|----------|---------|-----------|------|
| `promote-to-prod` | Read staging → snapshot to versions → write production | Production project | Service role (M1 test); admin auth (M2) |
| `rollback-to-version` | Restore prior version to production, log as new version | Production project | Service role (M1 test); admin auth (M2) |
| `stripe-webhook` | Receive Stripe subscription events → update entitlements → forward to GHL sync | Production project | Stripe signature verification |
| `ghl-sync` | Push subscription state to GHL custom fields/tags | Production project | Called by `stripe-webhook`; GHL API key in secrets |
| `push-streak-reminder` | Scheduled function: send web push to users at risk of breaking streak | Production project | Cron-invoked, service role |

Functions are deployed via the CLI:

```bash
supabase functions deploy <function-name> --project-ref <prod-ref>
```

Secrets are set per-project:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=... GHL_API_KEY=... \
  STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=...
```

The production project's own URL and service role key are auto-injected as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## Validation pattern (Zod, single source of truth)

Every content type has a Zod schema in `shared/schemas/`. TypeScript types derive from the schema:

```ts
// shared/schemas/lesson.ts
import { z } from "zod";

export const AnswerSchema = z.object({
  text: z.string().min(1, "Answer text is required"),
  is_correct: z.boolean(),
  explanation: z.string().min(1, "Explanation is required for every answer"),
});

export const QuestionSchema = z.discriminatedUnion("type", [
  // multiple_choice and hand_scenario variants
]);

export const LessonSchema = z.object({
  lesson_id: z.string().min(1),
  title: z.string().min(1),
  principle_tag: z.string().min(1),
  concept: z.string().min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  questions: z.array(QuestionSchema).min(1),
});

export type Lesson = z.infer<typeof LessonSchema>;
```

**Rules:**

1. Schemas are the source of truth. Types are derived with `z.infer`. Don't maintain parallel TypeScript types.
2. Every error message is user-facing. Write them like a tester wrote them, not a developer. Bad: "Invalid enum value." Good: "type must be either 'multiple_choice' or 'hand_scenario'."
3. Use `.refine()` for cross-field rules (e.g., "exactly one answer must have is_correct=true").
4. Always use `safeParse`, not `parse`, when handling untrusted input.
5. The validation utility lives in `src/lib/validate.ts` and returns a discriminated union: `{ ok: true, data } | { ok: false, errors }`.

The `formatPath` helper produces human-readable paths like `"question 3, answers, answer 2, explanation"` instead of Zod's default `["questions", 2, "answers", 1, "explanation"]`. It suppresses redundant parent segments when followed by a numeric index.

---

## The content pipeline

The pipeline is content-type-agnostic. Every content type goes through the same flow:

```
   Author the content              Validator catches errors
   (Claude bulk or wizard)         before they reach staging
        │
        ▼
   ┌─────────────┐
   │ Validate    │ ─── errors ──> show to author
   └─────────────┘
        │ valid
        ▼
   ┌─────────────┐
   │ Save to     │  Staging is a real Supabase
   │ Staging     │  project. Author can preview.
   └─────────────┘
        │
        ▼
   ┌─────────────┐  Edge Function: promote-to-prod
   │ Promote to  │  - Re-validates (server-side, M2)
   │ Production  │  - Snapshots to content_versions
   └─────────────┘  - Upserts content_published
        │           - Returns new version_number
        ▼
   Live content (members see it)
        │
        ▼ (anytime)
   ┌─────────────┐  Edge Function: rollback-to-version
   │ Rollback to │  - Reads a prior version
   │ Any Version │  - Appends as a NEW version (with source_version)
   └─────────────┘  - Upserts content_published to the rolled-back content
                    - Versions are append-only; nothing is destroyed
```

**Key design choices:**

- **Versioning is append-only.** Rollbacks don't delete history; they add a new version that points back at the restored one. This makes the audit trail complete.
- **Staging and production are separate Supabase projects.** Not separate schemas in one database. This isolates staging accidents from production users completely.
- **The validator runs at three points** (M2): in the wizard before save, on bulk upload before save, and server-side inside the promote Edge Function as a final gate.
- **Content type discriminator** (`content_type` column) added in M2 generalizes the pipeline. Pre-M2, only `lessons_*` tables exist. Post-M2, the tables are `content_*` with a discriminator.

---

## Authentication and entitlements

### Auth flow

1. **Subscription purchase** triggers Stripe checkout
2. **Stripe webhook** fires on successful payment
3. **Edge Function `stripe-webhook`** receives the event, verifies the signature, and:
   - Creates or updates the user record (if new)
   - Grants the `quiz_app_access` entitlement
   - Calls `ghl-sync` to update the CRM
4. **Member receives a magic link or password setup link** via Supabase Auth
5. **Subsequent logins** use password (preferred) or magic link (fallback/recovery)

### Entitlements model

The app checks entitlements, not raw Stripe subscription status. This decouples access from billing source.

```ts
// Conceptual gating check
const { data: entitlements } = await supabase
  .from("entitlements")
  .select("entitlement_key")
  .eq("user_id", userId)
  .is("expires_at", null);  // or .gt("expires_at", now)

const hasAccess = entitlements?.some(e => e.entitlement_key === "quiz_app_access");
```

Why this matters:
- Multiple Stripe price points (e.g., $27/mo, $47/mo, annual) all map to the same `quiz_app_access` entitlement.
- Future products (Masterclass, etc.) get their own entitlement keys without touching the existing model.
- Admin-granted access (e.g., for support cases) uses `source: 'manual'`.
- GHL-purchased subscriptions grant the same entitlement.

### Admin gating

The `/admin/*` routes check for a special entitlement: `admin_access` (or similar). This is granted manually in the database for the client (Steve) and any admins. M2 adds this gate to the validator UI and other admin pages.

---

## PWA and push notifications

### Manifest (`public/manifest.json`)

Standard PWA manifest with:
- App name, short name
- Icons in multiple sizes (192, 512)
- `display: "standalone"` for app-like full-screen
- `theme_color` and `background_color` matching the brand
- Start URL: `/`

### Service worker

Custom service worker handles:
- Install: cache the app shell (HTML, CSS, JS bundle)
- Activate: clean up old caches
- Fetch: cache-first for static assets, network-first for API calls
- Push: receive web push events and show notifications
- Notification click: open the relevant app URL

The caching strategy is coordinated with the content publish flow. The app uses a "stale-while-revalidate" pattern for content reads, with a version hint in the response so the SW invalidates when content updates.

### Web push (added M4)

VAPID keys generated once and stored:
- Public key: in the app source (Vite env)
- Private key: in Supabase Edge Function secrets

Push subscription flow:
1. Member opts in via a settings toggle
2. Frontend calls `pushManager.subscribe()` with the VAPID public key
3. Push subscription endpoint stored in `user_push_subscriptions` table
4. Scheduled Edge Function (`push-streak-reminder`) runs daily, queries users with active streaks at risk, sends push via Web Push protocol

iOS PWA caveat: web push works on iOS 16.4+ but only for installed PWAs (not safari tabs). Account for this in copy.

---

## Branching, commits, and PRs

### Branch strategy

- `master` → production deploys (Vercel auto-deploys from this branch)
- `dev` → preview deploys (Vercel auto-deploys from this branch)
- `feat/<feature-name>` → feature branches, branched from `dev`
- `fix/<bug-name>` → bugfix branches
- `chore/<task>` → housekeeping

PR target: feature branches PR into `dev`. Once `dev` is verified, PR `dev` into `master` for production.

### Commit messages

Conventional commits style:

```
feat: add nested glossary linking to drawer
fix: validator clears state on textarea edit
chore: bump zod to 4.0.5
docs: update schema spec with locked player type codes
test: add edge cases for hand_scenario validation
refactor: extract formatPath helper from validate.ts
```

### Pull requests

Every PR includes:
- A clear title summarizing the change
- A description with: what changed, why, how to test, screenshots if UI
- Linked GitHub issue if applicable
- A passing `npm run build` and `npm run lint`
- For UI changes: a deploy preview URL

Self-review before requesting review: check the diff, run the app locally, verify the change works.

---

## How to add a new content type

Walk-through example: adding `Tip` content.

1. **Add the Zod schema** in `shared/schemas/tip.ts`:

```ts
import { z } from "zod";

export const TipSchema = z.object({
  tip_id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  concept: z.string().min(1),
  related_glossary_terms: z.array(z.string()).optional(),
});

export type Tip = z.infer<typeof TipSchema>;
```

2. **Update the validator** to handle the new type. The validator is generic and dispatches by `content_type`. Add the new schema to its dispatch map:

```ts
// src/lib/validate.ts
import { LessonSchema } from "@/shared/schemas/lesson";
import { TipSchema } from "@/shared/schemas/tip";

const SCHEMAS = {
  lesson: LessonSchema,
  tip: TipSchema,
  // ...
} as const;

export function validateContent(type: ContentType, raw: unknown) {
  const schema = SCHEMAS[type];
  return schema.safeParse(raw);
}
```

3. **Update the Edge Functions** (`promote-to-prod`, `rollback-to-version`) to accept the `content_type` parameter and route to the right validator (M2 server-side re-validation).

4. **Add sample content** in `samples/valid-tip.json` and `samples/invalid-tip.json` covering edge cases.

5. **Add the schema section to `docs/schema-spec.md`** so the client can generate Tips with Claude.

6. **Add a UI surface** in the CMS wizard (M2) and the member-facing app (Today's Tip rotation, Saved Tips list, M2).

7. **Write tests** (see Testing approach below).

8. **Update the build log** in `docs/build-prompts.md` with the chunk that added this content type.

The point of the content pipeline is that you do NOT need to write new Edge Functions, new database tables, or new versioning logic. The existing pipeline handles all of it.

---

## How to add a new Edge Function

Walk-through: a hypothetical `send-welcome-email` function.

1. **Create the folder**: `supabase/functions/send-welcome-email/`

2. **Add `index.ts`**:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // tighten in M2
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Function logic here

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

3. **Deploy**:

```bash
supabase link --project-ref <prod-ref>
supabase functions deploy send-welcome-email
```

4. **Set any required secrets**:

```bash
supabase secrets set RESEND_API_KEY=...
```

5. **Verify**:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/send-welcome-email \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "abc"}'
```

6. **Call from the client** (if needed) via the Supabase client:

```ts
const { data, error } = await supabase.functions.invoke("send-welcome-email", {
  body: { user_id: "abc" },
});
```

---

## How to add a new React component

Walk-through: adding a `StreakBadge` component.

1. **Decide where it goes.** A standalone UI primitive goes in `src/components/`. A feature-grouped one goes in `src/components/<feature>/`. For `StreakBadge`, since it's tied to gamification UI, use `src/components/gamification/StreakBadge.tsx`.

2. **Write the component**:

```tsx
// src/components/gamification/StreakBadge.tsx
type StreakBadgeProps = {
  streak: number;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES = {
  sm: "text-sm px-2 py-1",
  md: "text-base px-3 py-1.5",
  lg: "text-lg px-4 py-2",
} as const;

export function StreakBadge({ streak, size = "md" }: StreakBadgeProps) {
  if (streak === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 font-semibold ${SIZE_CLASSES[size]}`}
      aria-label={`Current streak: ${streak} days`}
    >
      <span aria-hidden>🔥</span>
      <span>{streak}</span>
    </span>
  );
}
```

3. **Use it** in a page or another component. No global registration needed.

4. **Consider** if it deserves a test (see Testing).

5. **Avoid** premature abstraction. If you find yourself adding 5+ props for variations, you might be over-engineering. Start with one use case and generalize when needed.

---

## How to add a database migration

1. **Create the migration**:

```bash
supabase migration new add_user_saved_tips_table
```

This creates `supabase/migrations/<timestamp>_add_user_saved_tips_table.sql`.

2. **Write the SQL**:

```sql
-- Up: add table and RLS
create table public.user_saved_tips (
  user_id uuid references auth.users on delete cascade,
  tip_id text not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, tip_id)
);

alter table public.user_saved_tips enable row level security;

create policy "users_read_own_saved_tips" on public.user_saved_tips
  for select using (auth.uid() = user_id);

create policy "users_write_own_saved_tips" on public.user_saved_tips
  for insert with check (auth.uid() = user_id);

create policy "users_delete_own_saved_tips" on public.user_saved_tips
  for delete using (auth.uid() = user_id);
```

3. **Apply to staging first**:

```bash
supabase link --project-ref <staging-ref>
supabase db push
```

4. **Verify in the staging dashboard**: the table exists, RLS is on, policies are correct.

5. **Apply to production**:

```bash
supabase link --project-ref <prod-ref>
supabase db push
```

6. **Commit the migration file**. Never edit a migration that's been applied to production; write a new one to make changes.

---

## Testing approach

This codebase prioritizes:

1. **Type safety as a first defense.** TypeScript strict mode catches a large class of bugs at compile time.
2. **Zod validation as a runtime contract.** Every external input passes through a schema.
3. **End-to-end manual testing** for the content pipeline (paid test verification checklist).
4. **Targeted unit tests** for utility functions and validation logic.
5. **Selective integration tests** for Edge Functions and critical user flows.

### What we test

**Always:**
- Zod schema validation (positive and negative cases for every content type)
- Utility functions (`formatPath`, ID generators, date formatters)
- Edge Function happy paths and key error paths
- The content pipeline round-trip (validate → stage → promote → rollback)
- Critical user flows (subscribe → access; drill completion → progress saved)

**Sometimes:**
- React component rendering (when there's branching logic worth testing)
- Custom hooks (when state transitions are non-trivial)

**Rarely:**
- Static UI components without behavior
- Tailwind class application
- Framework code

### Test stack

- **Unit tests:** Vitest (Vite-native, fast)
- **Component tests:** React Testing Library (where applicable)
- **E2E:** Playwright (added in M4 for QA milestone)
- **API/Edge Function tests:** Deno's built-in test runner

### Running tests

```bash
npm run test           # Run all unit/component tests
npm run test:watch     # Watch mode for active development
npm run test:e2e       # Playwright E2E suite (M4)
```

### Test file location

- Unit tests next to source: `src/lib/validate.ts` → `src/lib/validate.test.ts`
- Edge Function tests inside the function folder: `supabase/functions/promote-to-prod/index.test.ts`
- E2E tests in `tests/e2e/`

### Coverage targets

- Validators (Zod schemas): 95%+ coverage of validation rules (each rule has at least one negative test)
- Edge Functions: happy path + at least 3 error paths each
- Critical utility functions: 100%
- React components: tested when they have non-trivial behavior; no coverage target for pure UI components

---

## Common pitfalls

**1. Forgetting `safeParse` vs `parse`.** Always use `safeParse` for untrusted input. `parse` throws, which is rarely what you want.

**2. Editing existing migrations.** Never. If a migration has been applied anywhere, write a new one to change things.

**3. Hard-coding the Supabase URL.** Always use the env-driven client from `src/lib/supabase.ts`. If you find yourself creating a new client somewhere, check first whether that's really needed.

**4. Forgetting RLS on user tables.** Every new user-data table gets RLS enabled in its migration. The default deny stance means missing policies block all access, not the other way around.

**5. Service role keys leaking.** Service role keys live ONLY in Supabase Edge Function secrets. Never in Vercel env vars, never in client code, never in git.

**6. Optimistic assumptions about Vercel rollback.** Vercel's one-click rollback rolls back CODE, not CONTENT. Content rollback is a separate mechanism in Supabase. They're independent.

**7. Mixing staging and production data.** Always confirm which Supabase project is linked before running migrations or destructive queries. The CLI shows the current ref; check it.

**8. Em dashes.** This project's style avoids em dashes in code comments and user-facing strings. Use commas, colons, semicolons, periods, or parentheses instead.

**9. Building a new pipeline for a new content type.** Don't. The pipeline is content-type-agnostic. Add a Zod schema, register it in the validator, done.

**10. Over-testing UI.** Component snapshot tests on every render is noise. Test behavior (clicks, state changes, accessibility), not output.
