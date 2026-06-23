# Beat Small Stakes — Poker Trainer

A mobile-first, subscription-gated PWA that teaches poker strategy through
scenario-based quizzes with instant teaching feedback — "Duolingo for poker."
Built around the client's Controlled Chaos methodology.

Two workstreams over one shared data model:

- **Member app** — static 9-max table, multiple-choice quizzes, slide-up feedback,
  nested-linking glossary, Skills Path, gamification.
- **Content Operations backbone (CMS)** — one content-type-agnostic pipeline
  (validate → stage → publish → rollback) across separate staging and production
  Supabase projects, with versioning and one-click content rollback.

> **Live status:** see [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) for what's
> shipped, in review, and next. This README covers how to run and work on the repo.

---

## Tech stack

| Layer | Choice |
|------|------|
| Frontend | Vite + React + TypeScript + Tailwind |
| Routing | React Router |
| Validation | Zod (schemas in `shared/schemas/`, types via `z.infer`) |
| Backend / data | Supabase — Postgres + RLS + Auth + Edge Functions (Deno) |
| Hosting | Vercel (`dev` → Preview, `master` → Production) |
| Payments / CRM | Stripe → GoHighLevel via Edge Function (M3) |

New dependencies require explicit client confirmation before install.

---

## Repository layout

```
src/
  components/    Validator, PublishedContent, VersionsPanel, BulkImport, RequireAuth, ...
  pages/         Route-level views (ValidatorPage, LoginPage)
  layout/        AdminLayout (Content Ops shell)
  lib/           supabase (staging) / supabase-prod / validate / auth
  router.tsx     Route table
shared/
  schemas/       Zod content schemas (lesson, glossary, tip, reference, path-node, content registry)
supabase/
  migrations/    Timestamped SQL, applied in order. Never edit a committed migration.
  functions/     Edge Functions (promote-to-prod, rollback-to-version) + _shared utils
docs/            Project brief, dev spec, schema spec, guides, status tracker
samples/         Sample lesson fixtures
```

---

## Getting started

Prerequisites: Node.js LTS (CI uses Node 22) and npm.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:5173
```

### Environment variables

Create `.env.local` (gitignored). Use the **staging** project's values locally —
this mirrors the Vercel Preview environment.

```bash
VITE_SUPABASE_URL=https://<staging-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
```

Vercel injects different values per branch (staging on Preview, production on
`master`), so the same build targets the right project automatically.

> **Never put a service-role key in a `VITE_` variable.** Anything prefixed
> `VITE_` is bundled into the client and visible to users. Service-role keys live
> only in Supabase Edge Function secrets.

---

## Common commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Serve the production build locally |

CI runs `npm ci`, `npm run lint`, and `npm run build` on every PR.

---

## Database & Edge Functions (Supabase CLI)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <staging-project-ref>   # verify the ref before any push

# Migrations
supabase migration new <description>   # create a new timestamped migration
supabase db push                       # apply pending migrations to the linked project

# Edge Functions
supabase functions deploy promote-to-prod
supabase functions deploy rollback-to-version
supabase secrets set KEY=value         # set function secrets (never in client code)

# Generate DB types after a schema change
supabase gen types typescript --project-ref <ref> > src/lib/supabase.types.ts
```

**Always apply migrations to staging first, then production.** Confirm the linked
project (`supabase projects list` / the CLI output) before running `db push` or
anything destructive.

Edge Function secrets in use:

| Secret | Where | Purpose |
|--------|-------|---------|
| `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` | prod project | promote reads staging cross-project |
| `ALLOWED_ORIGINS` | prod project | comma-separated CORS allow-list (falls back to `*` if unset) |
| `REQUIRE_ADMIN` | prod project | set `true` to enforce the admin gate on promote/rollback |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | auto-injected | hosting project access |

(Stripe and GoHighLevel secrets are added in M3.)

---

## Content pipeline

The CMS is content-type-agnostic: lessons, tips, references, and path nodes all
flow through the same machinery.

```
Author in CMS → validate (Zod, client) → save to staging
  → promote-to-prod (re-validates server-side) → versioned publish to production
  → rollback-to-version → restores any prior version as a new append-only version
```

- **Two Supabase projects** (staging + production) from day one.
- **Two-layer rollback:** code via Vercel's one-click revert; content via the
  Supabase versioned publish above. They roll back independently.
- **Bulk import** is the main content workflow: paste a JSON batch (generated with
  Claude using [`docs/schema-spec.md`](docs/schema-spec.md)) into the validator;
  green means valid and saved to staging.

The schema doc at [`docs/schema-spec.md`](docs/schema-spec.md) is the canonical
format reference — paste it into Claude to generate matching JSON.

---

## Admin / CMS access

The Content Ops area (`/admin`) is behind a Supabase Auth login. A bootstrap admin
is created by migration so a fresh environment has working access immediately.

> **Rotate the seeded admin password** (Supabase dashboard → Authentication →
> Users) on first login in any real environment — the bootstrap value lives in the
> migration and is not a secret.

Admin access is granted via the `admin_access` entitlement. To grant it to another
user after they sign up:

```sql
insert into entitlements (user_id, entitlement_key, source)
select id, 'admin_access', 'manual' from auth.users where email = '<email>'
on conflict do nothing;
```

---

## Branching & deploys

- Work on a branch per feature; open a PR into **`dev`**. Member-app and
  backend/API changes go in **separate PRs**.
- `dev` deploys to the Vercel **Preview** environment; `master` to **Production**.
- All deploys flow through GitHub → Vercel. No direct uploads.
- Migrations are immutable once committed — add a new migration to change schema.

---

## Documentation

| Doc | What |
|-----|------|
| [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) | Client, product, commercial terms, locked decisions |
| [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) | Live milestone progress tracker |
| [`docs/poker-trainer-v3-dev-spec.html`](docs/poker-trainer-v3-dev-spec.html) | Engineering spec |
| [`docs/schema-spec.md`](docs/schema-spec.md) | Canonical content schema (for AI bulk generation) |
| [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) | Architecture and how-to-extend |
| [`docs/REACT_FEATURE_IMPLEMENTATION_GUIDE.md`](docs/REACT_FEATURE_IMPLEMENTATION_GUIDE.md) · [`docs/SUPABASE_IMPLEMENTATION_GUIDE.md`](docs/SUPABASE_IMPLEMENTATION_GUIDE.md) | Coding conventions |
| [`docs/QA_GUIDE.md`](docs/QA_GUIDE.md) · [`docs/DEVOPS_GUIDE.md`](docs/DEVOPS_GUIDE.md) · [`docs/PROJECT_MANAGEMENT.md`](docs/PROJECT_MANAGEMENT.md) | QA, ops, PM playbooks |
