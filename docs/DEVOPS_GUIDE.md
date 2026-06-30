# DevOps Guide

Operational reference for the Poker Trainer project. Covers infrastructure setup, deployment pipelines, environment management, rollback procedures, and incident response. Written for whoever is operating the system, which during V1 is primarily the developer plus the client for verification.

---

## Table of contents

1. [Infrastructure overview](#infrastructure-overview)
2. [Environments](#environments)
3. [Supabase project setup](#supabase-project-setup)
4. [Vercel setup](#vercel-setup)
5. [GitHub workflow](#github-workflow)
6. [Database migrations](#database-migrations)
7. [Edge Function deployment](#edge-function-deployment)
8. [Secrets management](#secrets-management)
9. [Deployment procedures](#deployment-procedures)
10. [Two-layer rollback procedures](#two-layer-rollback-procedures)
11. [Domain and DNS](#domain-and-dns)
12. [Monitoring and logs](#monitoring-and-logs)
13. [Backup and disaster recovery](#backup-and-disaster-recovery)
14. [Incident response](#incident-response)
15. [Routine operational tasks](#routine-operational-tasks)

---

## Infrastructure overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          GitHub                                  │
│  beatsmallstakes/beat-small-stakes-app                          │
│  Branches: master (prod), dev (preview), feat/* (feature)       │
└────────────────┬────────────────────────┬───────────────────────┘
                 │ webhook on push        │ pull
                 ▼                        │
┌─────────────────────────┐               │
│       Vercel            │               │
│  - master → Production  │               │
│  - dev → Preview        │               │
│  - feat/* → Preview     │               │
│  Custom domain attached │               │
└────────────┬────────────┘               │
             │ HTTPS                       │
             ▼                            │
┌──────────────────────────────┐         │
│  app.poker-trainer.com       │         │
│  staging.poker-trainer.com   │         │
└──────────────┬───────────────┘         │
               │                          │
        ┌──────┴───────┬─────────────────┴────────┐
        │              │                          │
┌───────▼───────┐ ┌────▼───────────┐ ┌────────────▼──────────┐
│ Supabase      │ │ Supabase Edge  │ │ External services     │
│ (Production)  │ │ Functions      │ │ - Stripe              │
│ Project ID:   │ │ - promote      │ │ - GoHighLevel         │
│ <prod-ref>    │ │ - rollback     │ │ - (Email provider, M4)│
│               │ │ - stripe-hook  │ └───────────────────────┘
│ Postgres,     │ │ - ghl-sync     │
│ Auth,         │ │ - push-streak  │
│ Storage,      │ └────────────────┘
│ RLS           │
└───────────────┘
        ┬
        │
┌───────▼───────┐
│ Supabase      │
│ (Staging)     │
│ Project ID:   │
│ <staging-ref> │
└───────────────┘
```

**Two Supabase projects.** This is intentional: staging is for content preview before publish; production is what members see. They are wholly separate Supabase projects with their own URLs, anon keys, and service role keys.

**One GitHub repo.** All code (frontend, Edge Functions, migrations, docs) lives in one repository.

**Vercel handles code deploys and rollbacks.** One-click revert via the Vercel dashboard.

**Supabase handles content versioning and rollback.** Via the `lesson_versions` (or `content_versions` post-M2) table and the rollback Edge Function.

These two rollback layers are independent. Reverting code does not affect content. Rolling back content does not affect code.

---

## Environments

### Local development

- Runs on `npm run dev` against the staging Supabase project (read/write)
- Vite dev server at `http://localhost:5173`
- Env vars loaded from `.env.local` (gitignored)
- Service worker registered but caching is minimal in dev

### Preview (Vercel)

- Auto-deployed from `dev` branch and any `feat/*` branch
- URL: `<branch>-<repo>.vercel.app` (Vercel-generated)
- Custom subdomain (optional, M2+): `staging.poker-trainer.com`
- Uses staging Supabase project
- Used for: ongoing development, client demo, internal review

### Production (Vercel)

- Auto-deployed from `master` branch
- URL: `app.poker-trainer.com` (or whatever the client's domain is)
- Uses production Supabase project
- Used for: paying members

Branches and environments map cleanly:

| Branch   | Vercel environment | Supabase project | Audience                 |
| -------- | ------------------ | ---------------- | ------------------------ |
| `master` | Production         | Production       | Live members             |
| `dev`    | Preview            | Staging          | Internal + client review |
| `feat/*` | Preview (auto)     | Staging          | Feature in flight        |
| `fix/*`  | Preview (auto)     | Staging          | Bugfix in flight         |

---

## Supabase project setup

### Initial setup (one-time, per project)

Two projects are created in the Supabase dashboard:

- **poker-trainer-staging** (or similar): the staging environment
- **poker-trainer-prod** (or similar): the production environment

Both must be in the same region for consistent performance. Recommend a US region given the client's location (Chicago).

For each project:

1. **Database password:** generate and store securely
2. **Region:** choose the closest US region (e.g., `us-east-1`)
3. **Enable Email auth** with these settings:
   - Confirm email: off for staging, on for production
   - Allow signups: configurable per environment
   - JWT expiry: default (3600 seconds)
4. **Storage buckets:** create `avatars` and `assets` (RLS-protected)
5. **Enable required extensions:**
   - `pgcrypto` (for `gen_random_uuid()`)
   - `pg_trgm` (for text search, M2+)
   - `vector` (for pgvector, available but unused until V2)

### Project secrets to record

For each project, record (in a secrets vault, NOT in git):

- Project URL: `https://<ref>.supabase.co`
- Project ref: `<ref>` (used by CLI)
- Anon (public) key
- Service role (private) key
- Database password
- JWT secret (auto-generated, used for verifying tokens)

### Database password rotation

Rotate the database password if:

- Personnel changes
- Suspected compromise
- Annually as a baseline

To rotate:

1. Settings → Database → Reset database password
2. Update any external systems using the password
3. Document the rotation date

Anon and service role keys can also be rotated via Settings → API → Reset.

---

## Vercel setup

### Initial setup (one-time)

1. Create a Vercel account (under the client's email)
2. Import the GitHub repo
3. Configure build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
4. Set production branch to `master`
5. Configure environment variables (see below)
6. Attach the custom domain

### Environment variables on Vercel

Per environment (Production, Preview, Development):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

For Production:

- `VITE_SUPABASE_URL` → production project URL
- `VITE_SUPABASE_ANON_KEY` → production project anon key

For Preview and Development:

- `VITE_SUPABASE_URL` → staging project URL
- `VITE_SUPABASE_ANON_KEY` → staging project anon key

**Never** put service role keys, Stripe secret keys, or GHL API keys in Vercel env vars. Those belong in Supabase Edge Function secrets only.

### Vercel branch settings

- Production branch: `master`
- Preview deployments: all branches except master
- Auto-deploy on push: enabled
- Comment on pull requests: enabled (so PRs include a preview URL)

### Custom domain

Once the client provides the domain (e.g., `app.poker-trainer.com`):

1. Vercel dashboard → Project → Settings → Domains → Add
2. Add the domain
3. Follow Vercel's DNS instructions (usually a CNAME or A record)
4. Vercel issues a Let's Encrypt SSL certificate automatically
5. Verify HTTPS works
6. Optionally: add `staging.poker-trainer.com` pointing to the dev branch preview

---

## GitHub workflow

### Branches and protection

- `master`: protected. Requires PR. No direct pushes. Squash and merge.
- `dev`: protected. Requires PR. Squash and merge.
- `feat/*`, `fix/*`, `chore/*`: working branches, no protection.

### Pull request workflow

1. Branch from `dev`: `git checkout -b feat/skill-path-map`
2. Make commits (conventional commits style)
3. Push the branch
4. Open a PR targeting `dev`
5. PR triggers a Vercel preview deploy
6. Self-review the diff and the preview URL
7. Request review (if applicable) or merge directly if owner
8. Squash and merge into `dev`
9. Delete the feature branch

To deploy to production:

1. Open a PR from `dev` → `master`
2. Title: "Release: <date or version>"
3. Description: changelog of what's in this release
4. Merge after verification
5. Vercel deploys `master` to production

### GitHub Issues

Tracking work in GitHub Issues (see the "GitHub Projects" section at the end of this document for project board structure).

Issue templates:

- **Feature**: user story format, acceptance criteria
- **Bug**: reproduction steps, severity, environment
- **Task**: technical task with definition of done

Labels (suggested):

- `m1`, `m2`, `m3`, `m4`: milestone
- `frontend`, `backend`, `pipeline`, `auth`, `pwa`: area
- `p0`, `p1`, `p2`, `p3`: priority/severity
- `blocked`, `in-progress`, `ready-for-review`: state

---

## Database migrations

Migrations are SQL files in `supabase/migrations/`. Filename format: `<timestamp>_<description>.sql`.

### Creating a migration

```bash
supabase migration new add_user_streaks_table
```

This creates a new file with the next timestamp. Edit it to add the SQL:

```sql
-- Migration: add_user_streaks_table
-- Description: Tracks daily login streaks per user for gamification.

create table public.user_streaks (
  user_id uuid references auth.users on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_date date,
  primary key (user_id)
);

alter table public.user_streaks enable row level security;

create policy "users_read_own_streaks" on public.user_streaks
  for select using (auth.uid() = user_id);

create policy "users_write_own_streaks" on public.user_streaks
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_streaks" on public.user_streaks
  for update using (auth.uid() = user_id);
```

### Applying migrations

**Always apply to staging first:**

```bash
supabase link --project-ref <staging-ref>
supabase db push
```

Verify in the staging dashboard. Then apply to production:

```bash
supabase link --project-ref <prod-ref>
supabase db push
```

### Migration rules

1. **Migrations are immutable once applied.** Don't edit a migration that's been pushed to any environment.
2. **To change something, write a new migration.** Add columns, drop columns, alter constraints in new files.
3. **Always include RLS policies** in the same migration as the table creation. Never create a user-data table without RLS.
4. **Backward-compatible by default.** Avoid breaking changes to existing columns. If unavoidable (e.g., renaming), do it in two steps: add new column, migrate data, drop old column in a later release.
5. **Apply to staging first, always.** If something breaks in staging, it never reaches production.

---

## Edge Function deployment

### Initial deployment of a function

```bash
# Link to the target project (usually production)
supabase link --project-ref <prod-ref>

# Deploy the function
supabase functions deploy promote-to-prod

# Set required secrets
supabase secrets set STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co \
  STAGING_SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
```

### Verifying a function

After deploying:

```bash
# Test via curl
curl -X POST https://<prod-ref>.supabase.co/functions/v1/promote-to-prod \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":"test-lesson-01"}'

# View logs
supabase functions logs promote-to-prod
```

The dashboard shows function logs at: Supabase project → Edge Functions → <function-name> → Logs.

### Updating a function

```bash
# Make the code change in supabase/functions/<name>/index.ts
# Redeploy
supabase functions deploy <name>
```

Updates are zero-downtime. The new version is active immediately after deploy.

### Deleting a function

```bash
supabase functions delete <name>
```

This removes the function from the project but does not remove the code from the repo. Use with care.

---

## Secrets management

Secrets are categorized by where they live:

### Vercel environment variables (public-side secrets)

- `VITE_SUPABASE_URL` (public; anon-key-safe to expose)
- `VITE_SUPABASE_ANON_KEY` (public; RLS protects data)
- `VITE_VAPID_PUBLIC_KEY` (M4; web push public key)

These are bundled into the client JavaScript at build time. They are safe to expose because Supabase's RLS prevents anonymous access to private data.

### Supabase Edge Function secrets (server-side secrets)

```bash
supabase secrets set --project-ref <prod-ref> \
  STAGING_SUPABASE_URL=... \
  STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  STRIPE_SECRET_KEY=... \
  GHL_API_KEY=... \
  GHL_LOCATION_ID=... \
  VAPID_PRIVATE_KEY=...
```

These secrets are accessible only inside Edge Functions via `Deno.env.get(...)`. They never reach the client.

Auto-injected by Supabase into Edge Functions:

- `SUPABASE_URL` (the function's own project)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (the function's own project)

### Local development (`.env.local`)

Only the public-side keys for the staging project:

```
VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
```

Never put service role keys, Stripe keys, or GHL keys in `.env.local`. The local dev environment doesn't run Edge Functions directly; functions are tested against the deployed staging instance.

### Rotation policy

| Secret                     | When to rotate                                           |
| -------------------------- | -------------------------------------------------------- |
| Supabase database password | Annually or on suspicion of compromise                   |
| Supabase service role key  | Annually or after a security event                       |
| Stripe webhook secret      | When changing webhook endpoint                           |
| Stripe secret key          | If exposed, rotate immediately                           |
| GHL API key                | Annually or on personnel changes at GHL                  |
| VAPID keys                 | Avoid rotation (would invalidate all push subscriptions) |

---

## Deployment procedures

### Standard production deploy

1. Open a PR from `dev` to `master`
2. Title: "Release: <description>" (e.g., "Release: M2 quiz engine + CMS wizard")
3. Description: list of merged PRs, notable changes, any required migrations
4. Verify the dev branch preview is stable
5. Apply any pending production migrations BEFORE merging:
   ```bash
   supabase link --project-ref <prod-ref>
   supabase db push
   ```
6. Verify migrations in the production dashboard
7. Merge the PR
8. Watch the Vercel deploy in the dashboard
9. Once deployed, smoke-test production:
   - Open the production URL
   - Sign in (if applicable)
   - Run through the critical path (e.g., validator round-trip if M1, drill flow if M2)
10. If anything's wrong, follow the rollback procedure (next section)

### Deploying Edge Functions to production

Edge Functions are deployed independently of the Vercel deploy (they live in Supabase, not Vercel).

```bash
supabase link --project-ref <prod-ref>
supabase functions deploy <function-name>
```

For Edge Functions that reference the staging project (like `promote-to-prod`), make sure staging secrets are set on the production project:

```bash
supabase secrets set --project-ref <prod-ref> \
  STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co \
  STAGING_SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
```

### Coordinated deploys (code + database + functions)

For releases that touch multiple layers (e.g., M2 adds tables, Edge Functions, and UI), use this order:

1. **Apply database migrations to staging.** Verify.
2. **Deploy Edge Functions to staging** (if hosted in staging, which they usually aren't for our setup) or to production with staging awareness.
3. **Deploy code to staging via the `dev` branch.** Verify end-to-end.
4. **Apply database migrations to production.** Verify schema in dashboard.
5. **Deploy Edge Functions to production.**
6. **Deploy code to production via merging `dev` to `master`.** Verify.

If any step fails, stop and investigate before proceeding.

---

## Two-layer rollback procedures

### Code rollback (Vercel)

When to use: a production deploy broke something (UI bug, crash, broken feature).

1. Go to Vercel dashboard → Project → Deployments
2. Find the last known good deployment (above the broken one)
3. Click the three-dot menu → "Promote to Production"
4. Vercel switches the production alias to that deployment within seconds
5. Confirm the production URL serves the old version
6. Investigate the broken commit on `master`, write a fix on a `fix/*` branch
7. PR the fix into `master` to deploy the fix

This rolls back ONLY the code. Content, database state, and Supabase configuration are unaffected.

### Content rollback (Supabase)

When to use: a content publish broke the app or contained an error (wrong information, broken question, etc.).

The client can do this themselves via the admin UI (post-M2). Operationally, the steps are:

1. Open `/admin/versions` in the app (admin auth required, M2+)
2. Find the content_id with the problem
3. View the version history
4. Click "Rollback" on the previous good version
5. Confirm the dialog
6. The rollback Edge Function:
   - Reads the target version
   - Creates a new version entry with the target version's content (marked `created_by: rollback`, `source_version: <target>`)
   - Updates the published content to the rolled-back version
7. Members see the rolled-back content on next load (cache invalidates via service worker)

Pre-admin-UI (M1 only), the developer runs the rollback Edge Function directly:

```bash
curl -X POST https://<prod-ref>.supabase.co/functions/v1/rollback-to-version \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":"<id>","target_version":3}'
```

### Database rollback (manual, last resort)

If a migration broke production (extremely rare given the staging-first policy), the procedure is:

1. **Stop the bleeding:** if users are blocked, use Vercel rollback to revert to the last code that worked with the OLD schema (if compatible).
2. **Write a corrective migration:** never edit the bad migration. Write a new one that reverses or corrects the change.
3. **Apply to staging:** verify.
4. **Apply to production:** verify.
5. **Postmortem:** document what went wrong and why staging didn't catch it.

Supabase does NOT provide automatic database rollback for migrations. Treat migrations as forward-only and rely on staging-first policy to prevent broken migrations from reaching production.

---

## Domain and DNS

The client owns the domain. Developer needs DNS access (or the client adds the records).

### Required DNS records

**Production:**

```
Type    Host                   Value
A       app.poker-trainer.com  76.76.21.21 (Vercel's IP)
CNAME   app                    cname.vercel-dns.com
```

(Use whichever Vercel recommends; the exact records appear in the Vercel domain setup UI.)

**Staging (optional):**

```
Type    Host                       Value
CNAME   staging.poker-trainer.com  cname.vercel-dns.com
```

### SSL/TLS

Vercel issues and renews SSL certificates automatically via Let's Encrypt. No manual action needed unless the domain points away from Vercel.

### Email sender (M3, for password reset emails)

Supabase uses its built-in email service by default for development. For production, configure a transactional email provider:

- **Recommended:** Resend, SendGrid, or Postmark
- Set up DKIM, SPF, and DMARC records for the sending domain
- Add the SMTP credentials in Supabase Auth → Email → Custom SMTP

Without a custom email sender, Supabase's default emails work but come from a Supabase-branded address (less professional).

---

## Monitoring and logs

### Vercel logs

- Deployment logs: visible in the Vercel dashboard per deploy
- Runtime logs: Vercel Functions logs (if used; not used in V1 since Edge Functions live in Supabase)
- Edge Network logs: viewable in Vercel for client-side requests

### Supabase logs

- Database logs: Supabase dashboard → Database → Logs
- Auth logs: Supabase dashboard → Authentication → Users (login events visible)
- Edge Function logs: Supabase dashboard → Edge Functions → <function> → Logs
- API logs: Supabase dashboard → Reports

### Browser console

In production, console errors should be rare. When they occur:

- Capture the error message and stack
- Note the URL, user (if known), and browser
- File a bug per the QA bug reporting template
- Consider integrating a frontend error tracking service in V2 (Sentry, LogRocket)

### Health check pattern

Manual health check (run before client-visible demos or after major deploys):

```
1. Open production URL → page loads
2. Sign in → succeeds (if M3+)
3. Navigate to /drill or other key path → no console errors
4. Trigger a known data fetch → succeeds
5. Open Supabase dashboard → no recent error logs
6. Open Stripe dashboard → no recent failed webhook deliveries (M3+)
```

Set up automated uptime monitoring in V2 (UptimeRobot, Better Uptime, or similar).

---

## Backup and disaster recovery

### Database backups

Supabase Pro plan includes daily automated backups, retained for 7 days. Confirm the plan is on Pro for production (free plan does not include backups).

For additional safety:

- Weekly manual backup via `pg_dump` (the Supabase CLI can trigger this) into long-term storage
- Test restore procedure at least once per quarter

### Code backups

GitHub serves as the canonical code backup. Additionally:

- Tag releases on `master` (e.g., `v1.0.0-m1`)
- Optionally, mirror to a second remote (GitLab, Bitbucket)

### Disaster scenarios

**Scenario: Production database is corrupted or destroyed**

1. Identify the most recent good backup (Supabase Pro dashboard)
2. Restore via Supabase support (currently requires support ticket; verify procedure during M1)
3. Re-apply any migrations not in the backup
4. Verify schema integrity
5. Notify users if data loss occurred

Estimated recovery time: hours (depending on Supabase support response).

**Scenario: Vercel is down**

Vercel has high uptime but is not infallible. If down:

- Wait for Vercel status to recover (status.vercel.com)
- For extended outages, the app can be deployed elsewhere quickly (Netlify, Cloudflare Pages) using the same `npm run build` output
- Code is in GitHub; new hosting can be set up in under an hour

**Scenario: Supabase is down**

Less common but possible. Similar to Vercel: wait for recovery (status.supabase.com).
For prolonged outages, the app degrades gracefully:

- Service worker serves cached content
- Members may see "offline" state for new actions
- Auth flows fail but cached sessions remain valid

There is no current cross-cloud failover plan for V1. Adding one is V2+ territory.

---

## Incident response

### Severity definitions

- **P0:** Site is down or critical functionality broken. Users cannot use the app.
- **P1:** Major functionality degraded. Workaround exists but is poor.
- **P2:** Limited functionality affected. Workaround acceptable.
- **P3:** Minor issue. No user impact or trivial.

### Response procedure (P0)

1. **Acknowledge:** notify the client immediately via Slack
2. **Assess:** what's broken, what's the user impact, what's the suspected cause
3. **Mitigate:** roll back code (Vercel one-click revert) if it's a code regression. Roll back content if it's a content issue.
4. **Communicate:** post a status update to the client every 30 minutes minimum
5. **Resolve:** once mitigated, identify the root cause and write a fix on a `fix/*` branch
6. **Verify:** test the fix on staging, then deploy to production
7. **Postmortem:** within 48 hours of resolution, write a brief postmortem:
   - What happened
   - When (start, detection, mitigation, resolution timestamps)
   - Impact (how many users affected, what data was affected)
   - Root cause
   - What we did to fix it
   - What we'll do to prevent recurrence

### Communication template (for incident notifications)

```
[INCIDENT] Production app unavailable
Started: <time>
Status: investigating | mitigating | resolved
Impact: <brief>
Next update: <time>
```

---

## Routine operational tasks

### Weekly

- [ ] Review Vercel build logs for warnings or unusual patterns
- [ ] Review Supabase logs for query errors or RLS violations
- [ ] Review Stripe dashboard for failed webhook deliveries (M3+)
- [ ] Confirm scheduled functions (push reminders, M4+) are running on schedule
- [ ] Verify backup completion in Supabase dashboard

### Monthly

- [ ] Lighthouse audit on the production home page; record score
- [ ] Bundle size check: `npm run build` and review output sizes
- [ ] Dependency audit: `npm audit` and triage critical vulnerabilities
- [ ] Review Sentry/error tracking (when added in V2)
- [ ] Check Supabase plan utilization (storage, bandwidth, function invocations)
- [ ] Check Vercel plan utilization (bandwidth, builds, deployments)

### Per release

- [ ] Tag the `master` commit with a version
- [ ] Update a CHANGELOG.md (M2+) with what shipped
- [ ] Notify the client when production is updated
- [ ] Test rollback procedure on the deploy (don't actually roll back, just verify the procedure works on the new deploy)
- [ ] Update relevant documentation if behavior changed

### Quarterly

- [ ] Review all open issues; close stale ones
- [ ] Review security: dependencies, secrets, RLS policies
- [ ] Test disaster recovery: simulate a database restore (in a sandbox project)
- [ ] Review performance baselines; investigate if any regressed
- [ ] Review API usage for cost optimization opportunities

### Yearly

- [ ] Rotate database passwords and service role keys
- [ ] Review and update this documentation
- [ ] Renew SSL certificates (Vercel handles automatically; verify nothing's expired)
- [ ] Renew domain registration

---

## Appendix: useful commands

```bash
# Supabase CLI
supabase login                                # Authenticate
supabase link --project-ref <ref>             # Link to a project
supabase db push                              # Apply migrations
supabase migration new <name>                 # Create a new migration
supabase functions deploy <name>              # Deploy an Edge Function
supabase functions logs <name>                # View Edge Function logs
supabase secrets set KEY=value                # Set a secret on the linked project
supabase secrets list                         # List secrets on the linked project

# Git
git remote -v                                 # Confirm remotes
git branch -a                                 # List all branches
git fetch --all                               # Fetch from all remotes
git log --oneline -20                         # Recent commits
git tag v1.0.0-m1                             # Tag a release
git push origin v1.0.0-m1                     # Push the tag

# Vercel CLI (optional, mostly use dashboard)
vercel                                        # Deploy from local
vercel logs <deployment-url>                  # Tail logs
vercel env ls                                 # List env vars
vercel env add VAR_NAME                       # Add an env var

# npm
npm run dev                                   # Local dev server
npm run build                                 # Production build
npm run preview                               # Preview production build locally
npm run lint                                  # Lint
npm run typecheck                             # Type check
npm run test                                  # Run tests
npm audit                                     # Security audit
```
