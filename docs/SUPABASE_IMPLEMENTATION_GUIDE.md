# Supabase + Edge Functions — Feature Implementation Guide

> **Purpose**: Master prompt for AI agents implementing backend features in this project.
> This is the backend counterpart to `REACT_FEATURE_IMPLEMENTATION_GUIDE.md` — same
> principles (strict typing, separation of concerns, consistent patterns), applied to
> Supabase Postgres, Edge Functions (Deno 2 / TypeScript), Auth, Storage, and the
> Stripe + GoHighLevel integration layer. Every rule here reflects agreed codebase
> conventions — follow them exactly.

---

## Table of Contents

1. [Project Setup & Tooling](#1-project-setup--tooling)
2. [Folder Architecture & File Organization](#2-folder-architecture--file-organization)
3. [Supabase Client Setup](#3-supabase-client-setup)
4. [Database: Schema, Migrations & Conventions](#4-database-schema-migrations--conventions)
5. [Row Level Security (RLS)](#5-row-level-security-rls)
6. [Supabase Auth: Password + Magic Link](#6-supabase-auth-password--magic-link)
7. [Entitlements Model](#7-entitlements-model)
8. [Edge Functions: Structure & Conventions](#8-edge-functions-structure--conventions)
9. [Content Pipeline: Staging → Publish → Version → Rollback](#9-content-pipeline-staging--publish--version--rollback)
10. [Stripe: Subscriptions & Webhook Handling](#10-stripe-subscriptions--webhook-handling)
11. [GoHighLevel CRM Sync](#11-gohighlevel-crm-sync)
12. [Supabase Storage](#12-supabase-storage)
13. [Type Safety & Code Generation](#13-type-safety--code-generation)
14. [Environment & Configuration Management](#14-environment--configuration-management)
15. [Security Standards](#15-security-standards)
16. [Testing Standards](#16-testing-standards)
17. [Common Pitfalls](#17-common-pitfalls)
18. [Quick Reference: Decision Matrix](#18-quick-reference-decision-matrix)

---

## 1. Project Setup & Tooling

### Supabase CLI — Required

The Supabase CLI drives local development, migrations, and Edge Function deployment.

```bash
# Install globally
npm install -g supabase

# Or via scoop on Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify
supabase --version
```

### Local Development — Uses Staging Directly

The dev workflow connects to the **staging Supabase project directly**, not a local Postgres
instance. This keeps the schema in sync with what the team sees in the Supabase dashboard.

```bash
# Link the CLI to a project (one-time, per environment)
supabase login
supabase link --project-ref <staging-project-ref>

# Apply pending migrations to the linked project
supabase db push

# Deploy an Edge Function to the linked project
supabase functions deploy <function-name>

# To switch to the production project
supabase link --project-ref <prod-project-ref>
```

> Always confirm which project is linked before running migrations or destructive commands.
> The CLI shows the current ref; check it.

### Local Postgres Stack (Optional)

`supabase start` is available if you need a fully local environment, but the team default
is to use the staging project directly. Use `supabase start` only for isolated testing
where you don't want to touch the shared staging DB.

```bash
supabase start        # Starts local Postgres, Auth, Storage, Studio, Edge Runtime
supabase stop         # Stops everything
supabase status       # Shows URLs + keys for local services
```

Local services after `supabase start`:

| Service | URL | Purpose |
|---------|-----|---------|
| API (PostgREST) | `http://127.0.0.1:54321` | Auto-generated REST + GraphQL |
| Studio | `http://127.0.0.1:54323` | Database GUI |
| Inbucket | `http://127.0.0.1:54324` | Email testing (captures sent emails) |
| DB | `postgresql://127.0.0.1:54322/postgres` | Direct Postgres connection |

### TypeScript Strict Mode — Mandatory in Edge Functions

All Edge Functions are TypeScript. The Deno runtime enforces strict types at runtime and
import-time. Never use `any`; use `unknown` and narrow with type guards.

```typescript
// ✅ CORRECT
function parseBody(raw: unknown): { lesson_id: string } {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid body');
  const b = raw as Record<string, unknown>;
  if (typeof b.lesson_id !== 'string') throw new Error('lesson_id required');
  return { lesson_id: b.lesson_id };
}

// ❌ WRONG — never use any
function parseBody(raw: any) { return raw; }
```

---

## 2. Folder Architecture & File Organization

### Standard Layout

```
src/
  lib/
    supabase.ts                    # Supabase client (staging) — used by CMS/validator UI
    supabase-prod.ts               # Supabase client (production) — used by member-facing app
    validate.ts                    # Validation utility: wraps safeParse, formats error paths

shared/
  schemas/
    lesson.ts                      # LessonSchema, QuestionSchema, AnswerSchema (Zod)
    tip.ts                         # TipSchema (added M2)
    reference.ts                   # ReferenceSchema (added M2)
    path-node.ts                   # PathNodeSchema (added M2)
    glossary.ts                    # GlossaryEntrySchema

supabase/
  config.toml                      # Local dev config — ports, auth settings, etc.

  migrations/
    YYYYMMDDHHMMSS_description.sql # One file per schema change, ordered by timestamp

  functions/
    promote-to-prod/
      index.ts                     # Entry point — Deno.serve(...)
    rollback-to-version/
      index.ts
    stripe-webhook/
      index.ts                     # Verifies Stripe signature, updates entitlements, calls ghl-sync
    ghl-sync/
      index.ts                     # Pushes subscription state to GoHighLevel (called by stripe-webhook)
    push-streak-reminder/
      index.ts                     # Scheduled: send web push to users at risk of losing streak
    _shared/                       # Shared utilities imported by multiple functions
      responses.ts
      auth.ts

  seed.sql                         # Optional local seed data
```

### Folder Rules

| Folder | Rule |
|--------|------|
| `supabase/migrations/` | Schema-only SQL. Never DML (data inserts) in migrations except seed-data bootstrapping. One logical change per file. |
| `supabase/functions/` | One folder per Edge Function. Entry point is always `index.ts`. |
| `supabase/functions/_shared/` | Utilities imported across multiple functions. Never business logic — only pure helpers (CORS headers, JSON response factory, auth verification). |
| `src/lib/supabase.ts` / `supabase-prod.ts` | Thin client wrappers used by the React app. No business logic. |
| `src/lib/validate.ts` | Validation utility: calls `safeParse`, formats Zod error paths to human-readable form. |
| `shared/schemas/` | Zod schema definitions. Imported by the React app AND Edge Functions. Only code shared between them goes here. Never import React/JSX here. |

### File Naming

| Artifact | Convention | Example |
|----------|-----------|---------|
| Migration | `YYYYMMDDHHMMSS_snake_description.sql` | `20260605000001_promote_and_versioning.sql` |
| Edge Function | folder `snake-case/index.ts` | `promote-to-prod/index.ts` |
| Shared utility | `snake_case.ts` | `_shared/cors.ts` |
| Client file | `supabase.ts` / `supabase-prod.ts` | — |
| Type file | `*.types.ts` (in React src) | `content.types.ts` |

---

## 3. Supabase Client Setup

### Two Clients — Staging and Production

This project runs two separate Supabase projects: one for staging (authoring / preview) and
one for production (live member-facing content). The React app holds clients for both.
Both files live in `src/lib/`.

```typescript
// src/lib/supabase.ts  — staging client (used by the CMS/validator UI)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

```typescript
// src/lib/supabase-prod.ts  — production client (used by the member-facing app)
import { createClient } from '@supabase/supabase-js';

export const supabaseProd = createClient(
  import.meta.env.VITE_SUPABASE_URL,       // Vercel injects prod URL on the master branch
  import.meta.env.VITE_SUPABASE_ANON_KEY,  // Vercel injects prod anon key on the master branch
);
```

> The env var names are the same (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Vercel
> injects different values per environment: staging values for preview/dev branches, production
> values for the `master` branch. This is how one build artifact can target both environments.

### Client Rules

- **Always use the anon key** in the React app. The anon key respects RLS policies.
- **Never expose the service role key to the browser.** The service role key bypasses RLS
  and belongs only in Edge Functions via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.
- **One client per environment.** Never dynamically swap URLs at runtime.
- Import clients from `src/lib/supabase.ts` and `src/lib/supabase-prod.ts` — never call
  `createClient` directly inside a component or hook.

### Auth-Aware Client (Member App)

For the member-facing app, the Supabase client automatically attaches the user's JWT when
you use `supabase.auth.getSession()` and the client is initialized before the first query.
The anon client is sufficient; you do not need to create a separate authed client.

```typescript
// The client sends the user's JWT automatically after sign-in
const { data, error } = await prodSupabase
  .from('user_progress')
  .select('*');
// RLS policy checks auth.uid() — no extra setup needed
```

---

## 4. Database: Schema, Migrations & Conventions

### Migration File Rules

- **One migration = one logical unit of change.** Don't combine unrelated changes.
- **Never edit a committed migration.** Create a new migration to fix or extend it.
- Name migrations with a timestamp prefix and a descriptive suffix:
  `supabase migrations new promote_and_versioning` generates the timestamp automatically.
- Migrations run in timestamp order. Dependencies must be in earlier files.

```bash
# Create a new migration file with auto-generated timestamp
supabase migrations new add_entitlements_table

# Apply migrations to local DB
supabase db reset   # Wipes local DB and replays all migrations from scratch

# Push migrations to remote (staging or prod)
supabase db push --db-url "<connection-string>"
```

### Table Naming Conventions

| Convention | Example | Reason |
|-----------|---------|--------|
| `snake_case` plural | `user_entitlements` | PostgreSQL standard |
| Prefix by domain | `content_staging`, `content_published` | Grouping in Studio |
| Junction tables: `a_b` | `user_badges` | Clear join semantics |
| Audit / history: `_versions` suffix | `content_versions` | Consistent with content pipeline |

### Column Conventions

| Column | Type | Rule |
|--------|------|------|
| Primary key | `uuid DEFAULT gen_random_uuid()` | Standard for all user-facing tables |
| Content IDs (authored) | `text` | Stable human-readable slug set by the author |
| Timestamps | `timestamptz DEFAULT now()` | Always timezone-aware. Never `timestamp`. |
| Soft delete | `deleted_at timestamptz` | Prefer over hard delete for auditable data |
| JSON blobs | `jsonb` | Use for flexible content structures. Index with `gin` if queried. |
| Enums | `text` with a `CHECK` constraint | Avoid Postgres enum types — hard to migrate |

```sql
-- ✅ CORRECT — text + check constraint instead of enum
ALTER TABLE user_entitlements
  ADD CONSTRAINT entitlement_status_check
  CHECK (status IN ('active', 'cancelled', 'past_due'));

-- ❌ WRONG — Postgres enum, hard to add new values
CREATE TYPE entitlement_status AS ENUM ('active', 'cancelled', 'past_due');
```

### Index Rules

- Always index foreign keys.
- Index columns used in `WHERE` clauses with high cardinality.
- Add `DESC` indexes for `ORDER BY col DESC LIMIT n` patterns (used in version lookups).
- Add partial indexes (`WHERE condition`) for boolean flags like `is_active = true`.

```sql
-- Version lookup pattern used in this project
CREATE INDEX content_versions_content_id_version_desc_idx
  ON content_versions (content_id, version_number DESC);

-- Partial index for active entitlements only
CREATE INDEX user_entitlements_user_active_idx
  ON user_entitlements (user_id)
  WHERE status = 'active';
```

---

## 5. Row Level Security (RLS)

### RLS is Mandatory on Every Table

Enable RLS on every table immediately when creating it. The anon key used by the React app
will get no access until policies are added — this is the safe default.

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
```

### Policy Patterns Used in This Project

| Pattern | When to Use | SQL Example |
|---------|------------|-------------|
| Authenticated read | Content visible only to logged-in members (published lessons, glossary) | `USING (auth.role() = 'authenticated')` on `SELECT` |
| Owner read/write | Users can only see/edit their own rows | `USING (auth.uid() = user_id)` |
| No client access (Edge Functions only) | Tables mutated only by service-role via Edge Functions | No permissive policy on `INSERT`/`UPDATE`/`DELETE` |
| Admin entitlement | Restricted CMS operations — check `admin_access` entitlement | Checked inside Edge Function, not via RLS |

```sql
-- Published content: authenticated members can read, nobody writes via client
CREATE POLICY "authenticated read published"
  ON content_published FOR SELECT
  USING (auth.role() = 'authenticated');
-- No INSERT/UPDATE/DELETE policy → only service role (Edge Functions) can write

-- User's own progress: read and write own rows only
CREATE POLICY "own progress read"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "own progress write"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Service Role vs Anon Key

| Key | Bypasses RLS? | Use |
|-----|-------------|-----|
| Anon key | No — respects all RLS policies | React app (browser) |
| Service role key | Yes — full access | Edge Functions only, never in browser |

> **Never ship a service role key to the client.** If you find `SUPABASE_SERVICE_ROLE_KEY`
> in a `VITE_` environment variable, that is a critical security bug — move it to an Edge
> Function immediately.

### RLS Tightening Checklist

When moving from development permissive policies to production:

- [ ] Replace `USING (true)` write policies with Edge Function-only access (drop the policy)
- [ ] Add `auth.uid() IS NOT NULL` check on any authenticated-only read
- [ ] Verify the anon key cannot write to staging or versioning tables directly
- [ ] Test with the anon key in isolation (Studio → API → test with anon key)

---

## 6. Supabase Auth: Password + Magic Link

### Auth Model for This Project

Two sign-in methods are configured:
- **Password** — primary path. Used immediately after purchase (no email confirmation wait).
- **Magic link** — secondary / recovery path for users who forget their password.

```typescript
// Sign up with password (called by the post-purchase flow)
const { data, error } = await supabase.auth.signUp({
  email: user.email,
  password: user.password,
  options: {
    data: { full_name: user.fullName },  // stored in auth.users.raw_user_meta_data
  },
});

// Sign in with password
const { data, error } = await supabase.auth.signInWithPassword({
  email: form.email,
  password: form.password,
});

// Magic link (recovery / alternative sign-in)
const { error } = await supabase.auth.signInWithOtp({
  email: form.email,
  options: { shouldCreateUser: false },  // never create a new account via magic link
});

// Sign out
await supabase.auth.signOut();
```

### Session Management in React

Use the built-in `onAuthStateChange` listener — never manually manage session state.

```typescript
// core/auth/auth.store.ts (Zustand)
import { supabaseProd } from '../../lib/supabase-prod';

useEffect(() => {
  const { data: { subscription } } = supabaseProd.auth.onAuthStateChange(
    async (event, session) => {
      if (session) {
        useAuthStore.getState().setSession(session);
        await useAuthStore.getState().loadEntitlements();
      } else {
        useAuthStore.getState().clearSession();
      }
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

### Email Confirmation — Disabled for Immediate Access

The spec requires members to log in immediately after purchase with no email wait.
Email confirmation is explicitly disabled in `config.toml`:

```toml
[auth.email]
enable_confirmations = false
```

> Do NOT enable email confirmations without updating the post-purchase flow to handle the
> unconfirmed state. Members expect immediate access after subscribing.

### Password Requirements

Minimum 8 characters. Set in `config.toml` and enforced server-side by Supabase Auth:

```toml
[auth]
minimum_password_length = 8
```

Also enforce client-side with Zod in the React form:

```typescript
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
```

### Auth Roles & Admin Access

Admin access (CMS) is checked via an `admin_access` entitlement manually granted to
the client and any admins directly in the database. There is no separate admin users table —
the existing `entitlements` table is sufficient.

```sql
-- Grant admin access manually (no code change needed)
INSERT INTO entitlements (user_id, entitlement_key, source)
VALUES ('<steve-user-id>', 'admin_access', 'manual');
```

```typescript
// Edge Function: verify admin before mutating content
async function assertAdmin(req: Request, supabase: SupabaseClient): Promise<string> {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) throw new Error('Missing token');

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Error('Invalid token');

  const { data: entitlement } = await supabase
    .from('entitlements')
    .select('entitlement_key')
    .eq('user_id', user.id)
    .eq('entitlement_key', 'admin_access')
    .maybeSingle();

  if (!entitlement) throw new Error('Forbidden — admin only');
  return user.id;
}
```

The `/admin/*` routes in the React app also check the `admin_access` entitlement on
the client side (via `useHasAccess('admin_access')`), but the Edge Function check is the
true security gate.

---

## 7. Entitlements Model

### Design Principle

**The app checks entitlements, not raw subscription status.** A user has zero or more
entitlements, each mapped to a Stripe product/price. This means:
- New price points in Stripe require no code changes — just map them to the same entitlement
- Future products (Masterclass, etc.) get their own entitlement row, not a new subscription check

### Schema

```sql
CREATE TABLE entitlements (
  user_id         uuid REFERENCES auth.users ON DELETE CASCADE,
  entitlement_key text NOT NULL,       -- 'quiz_app_access' | 'admin_access' | future products
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,         -- null = no expiry (active indefinitely after subscription active)
  source          text,                -- 'stripe_sub_<id>' | 'manual' | 'ghl_<id>'
  PRIMARY KEY (user_id, entitlement_key)
);

CREATE INDEX entitlements_user_active_idx ON entitlements (user_id)
  WHERE expires_at IS NULL;

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
-- Read own entitlements
CREATE POLICY "own entitlements read" ON entitlements FOR SELECT USING (auth.uid() = user_id);
-- Writes only via service role (Edge Functions)
```

> The primary key is the composite `(user_id, entitlement_key)`. There is no separate UUID
> `id` column. This makes upserts natural and prevents duplicate grants.

### Checking Access in the React App

```typescript
// src/hooks/useEntitlements.ts
export function useHasAccess(key: string): boolean {
  // Entitlements loaded from supabase on sign-in, held in React context/Zustand
  const entitlements = useAuthStore(s => s.entitlements);
  // Active = no expiry OR expiry in the future
  return entitlements.some(
    e => e.entitlement_key === key &&
         (e.expires_at === null || new Date(e.expires_at) > new Date())
  );
}

// Usage
const hasQuizAccess = useHasAccess('quiz_app_access');
```

### Checking Access in Edge Functions

```typescript
async function assertEntitlement(
  userId: string,
  key: string,
  supabase: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('entitlements')
    .select('entitlement_key')
    .eq('user_id', userId)
    .eq('entitlement_key', key)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (!data) throw new Error('No active entitlement for: ' + key);
}
```

---

## 8. Edge Functions: Structure & Conventions

### Runtime

All Edge Functions run on **Deno 2** (set in `config.toml`). Import Supabase from JSR:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
```

Never use `npm:` specifiers for Supabase in Edge Functions. JSR is the correct registry.

### Anatomy of an Edge Function

Every Edge Function follows this exact structure:

```typescript
// functions/my-function/index.ts

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/responses.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. CORS preflight — always first
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Method guard
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
  }

  // 3. Read required env vars — fail fast if missing
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, message: 'Missing env vars' }, 500);
  }

  // 4. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  // validate body shape here (manual type guards or Zod)
  const { content_id } = validateBody(body);

  // 5. Create DB client using service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceKey);

  // 6. Business logic — early returns on errors
  const { data, error } = await supabase.from('...').select('...');
  if (error) return jsonResponse({ ok: false, message: error.message }, 500);
  if (!data) return jsonResponse({ ok: false, message: 'Not found' }, 404);

  // 7. Return success
  return jsonResponse({ ok: true, ...data });
});
```

### Shared Utilities — `functions/_shared/`

Always extract repeated code into `_shared/`. Never duplicate CORS headers or response
factories across functions.

```typescript
// functions/_shared/responses.ts
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': import.meta.env?.ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
```

```typescript
// functions/_shared/auth.ts
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export async function getUserFromRequest(
  req: Request,
  supabase: SupabaseClient
): Promise<string> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Missing Authorization header');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');
  return user.id;
}
```

### CORS Policy

- **Development / staging**: `'*'` is acceptable.
- **Production**: restrict to explicit domains:

```typescript
const ALLOWED_ORIGINS = [
  'https://yourapp.vercel.app',
  'https://poker.yourdomain.com',
];

const origin = req.headers.get('Origin') ?? '';
const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};
```

### Edge Function Inventory

| Function | Purpose | Auth |
|----------|---------|------|
| `promote-to-prod` | Read staging content → snapshot to versions → write to production | Admin entitlement (M2+); open in M1 test |
| `rollback-to-version` | Restore prior version to production as a new version entry | Admin entitlement (M2+) |
| `stripe-webhook` | Verify Stripe signature → update `entitlements` → call `ghl-sync` | Stripe signature verification |
| `ghl-sync` | Push subscription state to GoHighLevel via GHL REST API | Called internally by `stripe-webhook` |
| `push-streak-reminder` | Scheduled: send Web Push to users at risk of losing streak | Cron-invoked via scheduled job, service role |

### Deploying Edge Functions

```bash
# Deploy a single function to staging
supabase functions deploy promote-to-prod --project-ref <staging-ref>

# Deploy to production
supabase functions deploy promote-to-prod --project-ref <prod-ref>

# Set secrets (environment variables) for a function
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref <ref>

# List deployed functions
supabase functions list --project-ref <ref>
```

### Environment Variables in Edge Functions

Access via `Deno.env.get(key)`. Supabase automatically injects `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` for the hosting project. All other secrets must be set
explicitly with `supabase secrets set`.

| Variable | Set Automatically? | Who Sets It |
|----------|--------------------|------------|
| `SUPABASE_URL` | Yes | Supabase (hosting project URL) |
| `SUPABASE_ANON_KEY` | Yes | Supabase (hosting project anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase (hosting project service key) |
| `STAGING_SUPABASE_URL` | No | `supabase secrets set` on prod project |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | No | `supabase secrets set` on prod project |
| `STRIPE_SECRET_KEY` | No | `supabase secrets set` |
| `STRIPE_WEBHOOK_SECRET` | No | `supabase secrets set` |
| `GHL_API_KEY` | No | `supabase secrets set` |
| `GHL_LOCATION_ID` | No | `supabase secrets set` |
| `VAPID_PRIVATE_KEY` | No | `supabase secrets set` (M4 — web push) |

---

## 9. Content Pipeline: Staging → Publish → Version → Rollback

### Overview

The content pipeline is **content-type-agnostic**. All content types (Lessons, Tips,
References, Path nodes) flow through the same three-table pattern and the same Edge
Functions. No bespoke pipeline per type.

```
Author (React CMS)
  → validate (Zod, client-side)
  → save to content_staging (staging Supabase project)
  → preview on staging URL
  → promote-to-prod Edge Function
      → reads from staging
      → appends new row to content_versions (prod)
      → upserts content_published (prod)
  → member app reads from content_published (prod)

Rollback:
  rollback-to-version Edge Function
    → reads target snapshot from content_versions (prod)
    → appends new version row (created_by='rollback', source_version=<target>)
    → upserts content_published to point at new version
```

### Three-Table Pattern (Per Content Type)

```sql
-- staging table: last-write-wins per content_id
-- hosted in the STAGING Supabase project
CREATE TABLE content_staging (
  content_id   text PRIMARY KEY,
  content_type text NOT NULL,   -- 'lesson' | 'tip' | 'reference' | 'path_node'
  content      jsonb NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- published table: currently-live version per content_id
-- hosted in the PRODUCTION Supabase project
CREATE TABLE content_published (
  content_id      text PRIMARY KEY,
  content_type    text NOT NULL,
  content         jsonb NOT NULL,
  current_version int  NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- versions table: append-only history
-- hosted in the PRODUCTION Supabase project
CREATE TABLE content_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      text NOT NULL,
  content_type    text NOT NULL,
  version_number  int  NOT NULL,
  content         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text,              -- 'promote' | 'rollback'
  source_version  int,               -- set when created_by='rollback'
  UNIQUE (content_id, version_number)
);

CREATE INDEX content_versions_id_ver_desc ON content_versions (content_id, version_number DESC);
CREATE INDEX content_versions_id_date_desc ON content_versions (content_id, created_at DESC);
```

### Invariants — Never Break These

1. **Version numbers are append-only.** A rollback creates a NEW version row; it never
   deletes or mutates existing rows.
2. **`content_published.current_version` is the single source of truth** for what members
   see. Always update it atomically with the new version insert.
3. **The staging project is write-only from the CMS.** The production Edge Function reads
   staging via a cross-project service-role client. Members never touch staging.
4. **Re-validate inside the Edge Function** before writing to production. Client-side
   validation is a UX convenience, not a security gate.

### Promoting Content (Edge Function Pattern)

```typescript
// This pattern applies to ALL content types — pass content_type in the body
async function promoteContent(
  supabase_staging: SupabaseClient,
  supabase_prod: SupabaseClient,
  content_id: string,
  content_type: string
): Promise<{ version_number: number }> {
  // 1. Read from staging
  const { data: staged, error: stageErr } = await supabase_staging
    .from('content_staging')
    .select('content')
    .eq('content_id', content_id)
    .maybeSingle();
  if (stageErr || !staged) throw new Error('Not found in staging');

  // 2. Re-validate (server-side Zod check here — deferred to V1 per spec)

  // 3. Compute next version
  const { data: maxRow } = await supabase_prod
    .from('content_versions')
    .select('version_number')
    .eq('content_id', content_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version_number ?? 0) + 1;

  // 4. Append version snapshot
  await supabase_prod.from('content_versions').insert({
    content_id, content_type, version_number: nextVersion,
    content: staged.content, created_by: 'promote',
  });

  // 5. Upsert published
  await supabase_prod.from('content_published').upsert({
    content_id, content_type,
    content: staged.content, current_version: nextVersion,
    updated_at: new Date().toISOString(),
  });

  return { version_number: nextVersion };
}
```

---

## 10. Stripe: Subscriptions & Webhook Handling

### Architecture

Stripe is the billing source of truth. Supabase is the entitlements source of truth.
A Supabase Edge Function bridges them:

```
Stripe event → HTTPS webhook → stripe-webhook Edge Function
  → verify Stripe signature
  → update user_entitlements table
  → sync to GoHighLevel (same function, next step)
```

### Stripe Webhook Edge Function

```typescript
// functions/stripe-webhook/index.ts
import Stripe from 'npm:stripe@14';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse } from '../_shared/responses.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse({ ok: false }, 405);

  // 1. Verify Stripe signature — always first, never skip
  const signature = req.headers.get('stripe-signature');
  if (!signature) return jsonResponse({ ok: false, message: 'Missing signature' }, 400);

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return jsonResponse({ ok: false, message: `Webhook error: ${err.message}` }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 2. Handle relevant events
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription, supabase, 'active');
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription, supabase, 'cancelled');
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase);
      break;
  }

  // 3. Always return 200 to Stripe — never let retries cause double-processing
  return jsonResponse({ ok: true, received: true });
});
```

### Subscription Handler

```typescript
async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient,
  status: 'active' | 'cancelled'
): Promise<void> {
  // Look up the Supabase user by Stripe customer ID
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer as string)
    .maybeSingle();

  if (!profile) return; // Unknown customer — log and ignore

  // Upsert entitlement (idempotent — safe on retry)
  await supabase.from('user_entitlements').upsert({
    user_id: profile.user_id,
    entitlement_key: 'quiz_access',
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price.id,
    status,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,entitlement_key',
  });
}
```

### Stripe Idempotency Rules

- **Always upsert, never insert.** Stripe retries webhooks; duplicate events must not
  create duplicate rows.
- **Use `onConflict`** on the natural key (`user_id, entitlement_key`).
- **Always return HTTP 200** to Stripe even if internal processing fails. Use a dead-letter
  log table to capture failed events for re-processing. Never let Stripe disable the
  endpoint due to repeated non-200 responses.

---

## 11. GoHighLevel CRM Sync

### Architecture

GHL sync is a **separate Edge Function** (`ghl-sync/`) that is called from inside
`stripe-webhook` after entitlements are updated. They are separate functions so each
can be deployed, tested, and logged independently.

```
Stripe event
  → stripe-webhook Edge Function
      → verify signature
      → update entitlements table
      → invoke ghl-sync (internal Supabase function call)
          → push state to GHL REST API
```

```typescript
// Inside stripe-webhook/index.ts — call ghl-sync as a sub-invocation
const ghlRes = await supabase.functions.invoke('ghl-sync', {
  body: { email, status, subscription_id: subscription.id },
});
// Log failures but do not re-throw — Stripe must receive 200
if (ghlRes.error) {
  console.error('[ghl-sync] failed:', ghlRes.error);
}
```

### GHL Sync Function (`ghl-sync/index.ts`)

```typescript
Deno.serve(async (req: Request): Promise<Response> => {
  const { email, status, subscription_id } = await req.json() as {
    email: string;
    status: 'active' | 'cancelled';
    subscription_id: string;
  };

  const apiKey = Deno.env.get('GHL_API_KEY')!;
  const locationId = Deno.env.get('GHL_LOCATION_ID')!;

  // Tag taxonomy agreed with client: quiz_app_active | quiz_app_cancelled
  const tag = status === 'active' ? 'quiz_app_active' : 'quiz_app_cancelled';

  await fetch(`https://rest.gohighlevel.com/v1/contacts/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      locationId,
      tags: [tag],
      customField: { quiz_app_status: status },
    }),
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

### GHL Rules

- GHL sync failures do NOT propagate back to `stripe-webhook`. A GHL API failure must
  never cause `stripe-webhook` to return non-200 to Stripe. Log failures; Stripe must
  always get 200.
- Never put GHL logic in the React app. All GHL calls happen in Edge Functions only.
- Secrets required: `GHL_API_KEY` and `GHL_LOCATION_ID` (set with `supabase secrets set`).
- Tag taxonomy (`quiz_app_active`, `quiz_app_cancelled`, `quiz_app_payment_failed`) must be
  agreed with the client before M3 and created in GHL before the webhook is live.

---

## 12. Supabase Storage

### Bucket Setup

```sql
-- Storage buckets are configured via migration or the Supabase dashboard
-- For avatar images (client-supplied, served publicly):
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- For content imports (private, admin-only):
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-imports', 'content-imports', false);
```

### Storage RLS

```sql
-- Public read on avatars bucket
CREATE POLICY "public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Admin-only write on avatars
CREATE POLICY "admin write avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.jwt() ->> 'role' = 'admin');

-- Content imports: only service role (Edge Functions)
-- No client policy → service role only
```

### Uploading from React

```typescript
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`player-types/${filename}`, file, {
    cacheControl: '3600',
    upsert: true,
  });

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl(`player-types/${filename}`);
```

---

## 13. Type Safety & Code Generation

### Generate TypeScript Types from Supabase Schema

Run after every migration that adds or changes tables/columns:

```bash
# Generate types for the local DB
supabase gen types typescript --local > src/lib/supabase.types.ts

# Generate types for a remote project (staging or prod)
supabase gen types typescript --project-ref <ref> > src/lib/supabase.types.ts
```

### Using Generated Types

```typescript
// src/lib/supabase.types.ts — generated, never hand-edit
export type Database = {
  public: {
    Tables: {
      content_published: {
        Row: { content_id: string; content: Json; current_version: number; ... }
        Insert: { content_id: string; ... }
        Update: Partial<Insert>
      }
      // ...
    }
  }
}

// Use with the client for full type safety
import type { Database } from './lib/supabase.types';
const supabase = createClient<Database>(url, key);

// Now .from('content_published').select() returns typed rows
const { data } = await supabase.from('content_published').select('*');
// data is Database['public']['Tables']['content_published']['Row'][]
```

### Zod Schemas for Content Types

Content validation schemas live in `shared/schemas/` and are imported by BOTH the
React app and Edge Functions. This is the only folder in the project shared between
client and server code. Never add React imports (JSX, hooks) here.

```typescript
// shared/schemas/lesson.ts
import { z } from 'zod';

export const AnswerSchema = z.object({
  text: z.string().min(1, 'Answer text is required'),
  is_correct: z.boolean(),
  explanation: z.string().min(1, 'Explanation is required for every answer'),
});

// Use discriminatedUnion for question types so Zod narrows the type precisely
export const QuestionSchema = z.discriminatedUnion('type', [
  z.object({
    question_id: z.string().min(1),
    type: z.literal('multiple_choice'),
    prompt: z.string().min(1),
    answers: z.array(AnswerSchema).length(4).refine(
      (answers) => answers.filter(a => a.is_correct).length === 1,
      { message: 'Exactly one answer must have is_correct: true' }
    ),
    glossary_terms: z.array(z.string()).optional(),
  }),
  z.object({
    question_id: z.string().min(1),
    type: z.literal('hand_scenario'),
    prompt: z.string().min(1),
    answers: z.array(AnswerSchema).length(4).refine(
      (answers) => answers.filter(a => a.is_correct).length === 1,
      { message: 'Exactly one answer must have is_correct: true' }
    ),
    table_state: z.object({
      street: z.enum(['preflop', 'flop', 'turn', 'river']),
      hero_position: z.string().min(1),
      hero_hole_cards: z.array(z.string()).optional(),
      board_cards: z.array(z.string()).optional(),
      pot_size: z.number().min(0).optional(),
      stack_sizes: z.record(z.string(), z.number()).optional(),
      villain_player_types: z.record(z.string(), z.string()).optional(),
      notes: z.string().optional(),
    }),
    glossary_terms: z.array(z.string()).optional(),
  }),
]);

export const LessonSchema = z.object({
  lesson_id: z.string().min(1),
  title: z.string().min(1),
  principle_tag: z.string().min(1),
  concept: z.string().min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  questions: z.array(QuestionSchema).min(1),
});

export type Lesson = z.infer<typeof LessonSchema>;
export type Question = z.infer<typeof QuestionSchema>;
```

### safeParse — Mandatory for Untrusted Input

Always use `safeParse`, never `parse`, when handling input from the browser or any
external source. `parse` throws synchronously and is only acceptable for internal test
fixtures that you control.

```typescript
// src/lib/validate.ts — wraps safeParse with human-readable error paths
import { LessonSchema } from '../../shared/schemas/lesson';

export function validateLesson(raw: unknown) {
  const result = LessonSchema.safeParse(raw);
  if (result.success) return { ok: true as const, data: result.data };
  return {
    ok: false as const,
    errors: result.error.issues.map(issue => ({
      path: formatPath(issue.path),  // "question 3, answers" not ["questions",2,"answers"]
      message: issue.message,
    })),
  };
}

// ✅ CORRECT — always safeParse
const result = validateLesson(userInput);
if (!result.ok) { showErrors(result.errors); return; }

// ❌ WRONG — never parse untrusted input
const data = LessonSchema.parse(userInput);  // throws on invalid input
```

---

## 14. Environment & Configuration Management

### Required Database Extensions

Enable these in both staging and production Supabase projects (Settings → Database → Extensions):

| Extension | Purpose |
|-----------|---------|
| `pgcrypto` | `gen_random_uuid()` — used by all primary keys |
| `pg_trgm` | Text similarity search — used for glossary fuzzy search (M2+) |
| `vector` | pgvector — available for future AI features; enable now so it's ready |

```sql
-- Enable extensions via migration (add to the initial schema migration)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
```

### Two Supabase Projects — Mandatory

| Environment | Project | Purpose |
|-------------|---------|---------|
| Staging | `poker-trainer-staging` | Content authoring, validator UI, preview |
| Production | `poker-trainer-prod` | Live member-facing content and user data |

Never use a single project for both. Staging schema changes must be migrated to prod
separately and deliberately.

### Environment Variables in the React App

Vercel uses **one pair of env var names** and injects different values per environment:

| Branch | `VITE_SUPABASE_URL` | `VITE_SUPABASE_ANON_KEY` |
|--------|---------------------|--------------------------|
| `master` (Production) | Production project URL | Production anon key |
| `dev` / `feat/*` (Preview) | Staging project URL | Staging anon key |

This means the same app code (`src/lib/supabase.ts`) targets the right project automatically
based on which branch Vercel deployed from.

```bash
# .env.local  (gitignored — never commit)
# Use staging values locally (mirrors the Preview environment)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# M4 — web push VAPID public key (safe to expose)
VITE_VAPID_PUBLIC_KEY=BN...

# .env.example  (commit this — no real values)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

> **Never put `SERVICE_ROLE_KEY` in a `VITE_` variable.** It is bundled into the
> client-side JS and visible to anyone who opens DevTools.

### Secrets in Edge Functions

```bash
# Set all server-side secrets on the production project
supabase secrets set --project-ref <prod-ref> \
  STAGING_SUPABASE_URL=https://xxxx.supabase.co \
  STAGING_SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  GHL_API_KEY=... \
  GHL_LOCATION_ID=... \
  VAPID_PRIVATE_KEY=...

# Staging project also needs Stripe test keys for webhook testing
supabase secrets set --project-ref <staging-ref> \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  GHL_API_KEY=... \
  GHL_LOCATION_ID=...
```

### `config.toml` — Local Dev Only

`config.toml` configures the local Supabase stack (ports, auth settings, edge runtime).
It does **not** affect remote projects. Remote project settings are configured via the
Supabase dashboard or CLI flags.

---

## 15. Security Standards

### Never in the Browser

| Item | Why |
|------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses all RLS — complete DB access |
| `STRIPE_SECRET_KEY` | Can create charges, issue refunds, access billing data |
| `GHL_API_KEY` | Full CRM access |
| Direct DB connection strings | Exposes DB host and credentials |

All of the above belong exclusively in Edge Functions via `Deno.env.get()`.

### Input Validation — Two-Layer Rule

| Layer | Tool | Gate |
|-------|------|------|
| Client (React) | Zod | UX feedback — not a security gate |
| Server (Edge Function) | Zod / manual type guards | True security gate |

Always re-validate inside Edge Functions. Never trust data that arrived from the browser,
even if it passed client-side validation.

### SQL Injection — Not Applicable for Direct Queries

The Supabase JS client uses PostgREST and parameterizes all inputs automatically. You
cannot construct raw SQL via `.from()` chains. SQL injection is only possible in:
- Postgres functions called via `supabase.rpc()`
- Raw SQL in migrations (`EXECUTE` with interpolation)

In both cases, use parameterized queries or `quote_literal()`.

### Stripe Webhook Signature Verification — Mandatory

Every request to the `stripe-webhook` Edge Function **must** be verified using the
Stripe library's `constructEventAsync`. Never process a Stripe webhook without this check.

```typescript
// ✅ CORRECT — always verify
const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

// ❌ WRONG — never parse the body directly
const event = await req.json();  // trusts the sender completely
```

### CORS Hardening Before Launch

The CORS allow-list defaults to `'*'` during development. Before production launch:
1. Replace `'*'` with the explicit Vercel domain(s) in every Edge Function.
2. Update after each Vercel deployment alias change.
3. Set via `Deno.env.get('ALLOWED_ORIGIN')` rather than hardcoding.

---

## 16. Testing Standards

### Local Edge Function Testing

```bash
# Serve all functions locally
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/promote-to-prod \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon-key>" \
  -d '{"lesson_id": "lesson-001"}'
```

### Unit Testing Edge Functions (Deno)

```typescript
// functions/promote-to-prod/index.test.ts
import { assertEquals } from 'jsr:@std/assert';

Deno.test('returns 405 for non-POST requests', async () => {
  const req = new Request('http://localhost/promote-to-prod', { method: 'GET' });
  const res = await handler(req);
  assertEquals(res.status, 405);
});

Deno.test('returns 400 for missing lesson_id', async () => {
  const req = new Request('http://localhost/promote-to-prod', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.ok, false);
});
```

```bash
# Run Deno tests
deno test --allow-env supabase/functions/
```

### Testing RLS Policies

Use the Supabase Studio SQL editor or test with different JWT tokens:

```sql
-- Test as anon user (should see published content, not write it)
SET LOCAL role TO anon;
SELECT * FROM content_published LIMIT 5;    -- should succeed
INSERT INTO content_published ...;           -- should fail (RLS)

-- Test as authenticated user
SET LOCAL "request.jwt.claims" TO '{"sub":"<user-id>","role":"authenticated"}';
SET LOCAL role TO authenticated;
SELECT * FROM user_entitlements;  -- should see only own rows
```

### Coverage Targets

| Layer | Minimum |
|-------|---------|
| Edge Functions (business logic paths) | 80% |
| Auth + entitlement checks | 90% |
| Zod validators | 95% — test every error path |
| Migration SQL (smoke test on reset) | 100% — `supabase db reset` must succeed |

---

## 17. Common Pitfalls

These are the most common mistakes in this codebase. Read before implementing.

1. **`parse` instead of `safeParse`.** Always use `safeParse` for untrusted input (browser, API). `parse` throws synchronously, which is never what you want when handling user data.

2. **Editing an existing migration.** Never. If a migration has been applied to any environment, write a new one. Editing applied migrations breaks `supabase db push` for everyone.

3. **Forgetting RLS on new tables.** Every new user-data table gets `ALTER TABLE x ENABLE ROW LEVEL SECURITY` in the same migration as the `CREATE TABLE`. The default deny stance means missing policies silently block all access.

4. **Service role key in a Vercel env var.** Service role keys live ONLY in Supabase Edge Function secrets (`supabase secrets set`). Never in Vercel env vars, never in `.env.local`, never in git. Critical security bug if found.

5. **Building a new pipeline for a new content type.** Don't. The pipeline is content-type-agnostic. Add a Zod schema in `shared/schemas/`, register it in `src/lib/validate.ts`, and the existing Edge Functions and tables handle the rest.

6. **Confusing Vercel rollback with content rollback.** Vercel rollback reverts CODE only. Content rollback is a separate operation via the `rollback-to-version` Edge Function. They are independent.

7. **Confirming the wrong linked project.** Always run `supabase status` or check `supabase/.temp/project-ref` before running migrations or destructive queries. Re-link explicitly when switching environments.

8. **Letting GHL sync failure break the Stripe webhook.** The `stripe-webhook` function must return 200 to Stripe regardless of GHL sync outcome. Catch GHL errors, log them, continue.

9. **Writing shared code (schemas) with React imports.** `shared/schemas/` is imported by Edge Functions (Deno). Any React/JSX import there will break the Edge Function build. Keep `shared/` pure TypeScript.

10. **Using `is_current` or mutable flags for versioning.** The version history is append-only. `content_published.current_version` is the single source of truth; it points to the latest snapshot. Never add an `is_current` boolean to `content_versions`.

---

## 18. Quick Reference: Decision Matrix

| Decision | Answer |
|----------|--------|
| Which Supabase client in React? | **Anon key client** from `src/lib/supabase.ts` — never service role in browser |
| Which key in Edge Functions? | **Service role key** via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` |
| Import Supabase in Edge Functions? | `jsr:@supabase/supabase-js@2` — never `npm:` |
| Where do Zod schemas live? | **`shared/schemas/`** — imported by both React and Edge Functions |
| Validate with `parse` or `safeParse`? | **`safeParse` always** for untrusted input — `parse` throws |
| RLS on new tables? | **Always** — `ALTER TABLE x ENABLE ROW LEVEL SECURITY` in the same migration |
| Write policy on tables mutated by Edge Functions? | **None** — service role bypasses RLS; dropping the write policy is the gate |
| Published content readable by anon users? | **No** — `auth.role() = 'authenticated'` on `SELECT` |
| Admin gating approach? | **`admin_access` entitlement** — checked inside Edge Functions, not via RLS |
| New migration or edit existing? | **New migration always** — never edit a committed file |
| Stripe webhook: trust body without signature? | **Never** — always `constructEventAsync` first |
| Stripe webhook: fail on GHL sync error? | **No** — return 200 to Stripe, log the GHL failure |
| Stripe updates: insert or upsert? | **Upsert** — webhooks retry; must be idempotent |
| Where does GHL sync happen? | **Separate `ghl-sync` Edge Function** called from `stripe-webhook` — never in React |
| GHL secrets needed? | **`GHL_API_KEY` and `GHL_LOCATION_ID`** — both required |
| `SERVICE_ROLE_KEY` in `VITE_` env var? | **Never** — critical security bug |
| Vercel env var names for Supabase? | **One pair** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); Vercel injects different values per branch |
| Content pipeline per type (Lesson, Tip, etc.)? | **Single pipeline** — `content_type` discriminator, same tables and Edge Functions |
| Rollback deletes old versions? | **Never** — append-only history, rollback creates a new version row |
| CORS in production? | **Explicit allow-list** — never `*` in production Edge Functions |
| Zod validation runs where? | **Both client (UX) and Edge Function (security gate)** |
| TypeScript types for DB? | **Generated via `supabase gen types`** after each migration |
| Enum columns in Postgres? | **`text` + `CHECK` constraint** — never `CREATE TYPE AS ENUM` |
| Timestamps? | **`timestamptz`** always — never plain `timestamp` |
| Primary keys for user-facing tables? | **`uuid DEFAULT gen_random_uuid()`** |
| Content IDs (authored content)? | **`text`** — stable human-readable slug (`"preflop-opens-utg"`) |
| Entitlements PK? | **Composite `(user_id, entitlement_key)`** — no separate UUID id |
| SQL injection risk? | **Low for `.from()` chains** (PostgREST parameterizes). Guard `rpc()` and raw SQL. |
| Required Postgres extensions? | **`pgcrypto`, `pg_trgm`, `vector`** — enable in both projects |
| Local dev uses local Postgres or staging? | **Staging directly** — `supabase link` and `supabase db push` |
