# #77 Security questions: BE answers and status

Prepared 2026-10-16 on branch `be/77-security-hardening`. Finding IDs (F-xxx) refer to `security-audit/results/findings.md`.

**Status:** all migrations below are applied and tested on **staging**. Nothing is on prod yet.

## Done on the branch (staging-tested)

| Migration | Fixes |
|---|---|
| `20261016100000_content_seq_counters_rls.sql` | F-005: commits the hand fix from 2026-09-30 and also revokes the leftover TRUNCATE/TRIGGER/REFERENCES grants from anon/authenticated. |
| `20261016110000_admin_gate_catalog_and_tag_cache.sql` | F-002: Pro Training course writes are admin-only (members could edit or delete courses and change `sales_url`). F-006: the GHL tag cache is admin-only. |
| `20261016120000_lock_stripe_customer_id.sql` | F-003: members can no longer change `user_profiles.stripe_customer_id`. They can still update `full_name`. |
| `20261016130000_gate_published_content.sql` | **F-004 (Critical):** published content was readable with only the public anon key. It now requires an active `quiz_app_access` or `admin_access` entitlement. `content_versions` is admin-only. |
| `20261016140000_reference_images_limits.sql` | F-010: the bucket accepts only png/jpeg/webp/gif images up to 5 MB, and uploads are admin-only. Before this, any member could upload. |
| `20261016150000_edge_rate_limits.sql` + `_shared/rate-limit.ts` | F-013: `create-checkout-session` and `post-purchase-signin` allow 10 requests per minute per IP, then return 429. The check fails open, so a DB error never blocks a purchase. |

**Staging test results** (SQL run as each user in a rolled-back transaction; the 429s are live HTTP results):

- Admin: reads published content and versions, reads the tag cache, can edit courses.
- Member: reads published content only. No versions, no tag cache, no course edits.
- User without an entitlement: reads nothing.
- Anon: empty result on content, permission denied on the counter table, the rate-limit table and the RPC.
- All three users: the `stripe_customer_id` update is denied and the name update works.
- Rate limit: requests 11 and 12 within a minute return 429 on both functions.

**FE note (Dejan):** `auth.tsx` sets `hasAccess` from `status = 'active'` only, while the DB also checks `expires_at`. A member whose entitlement is active but past its expiry passes the route guard and then sees empty content. Consider adding the `expires_at` check in the FE too.

## Prod rollout (needs go-ahead)

1. `supabase link --project-ref ypbgytbdowfzyfikesfg && supabase db push --linked`, then relink staging.
2. `supabase functions deploy create-checkout-session --no-verify-jwt --project-ref ypbgytbdowfzyfikesfg`, and the same for `post-purchase-signin`. **`--no-verify-jwt` is mandatory**, otherwise pay-first checkout breaks.
3. Smoke test: anon GET `content_published` returns `[]`. A member can still open a lesson, an admin can still open Versions, and a test checkout still works.

## Answers by topic

**RLS review + Security Advisor.** All 24 public tables were reviewed in the audit. Every RLS FAIL is fixed on this branch: F-002, F-003, F-004, F-005 and F-006. Re-checking the Supabase Security Advisor needs the fresh PAT or the dashboard.

**Row limits per request.** This is PostgREST `max_rows` (default 1000). Recommendation: set it to 500. That's above our largest list (glossary, about 170 rows) with headroom. It needs the PAT (`/config/database/postgrest`). After F-004, only paying members can read content at all.

**Rate limits and alerts for unusual lesson loading.** Lessons are read straight from the database by the browser, so a per-user read limit would mean moving content reads behind an RPC or Edge Function, which is a bigger FE+BE change. Proposed instead:
- F-004 limits reads to paying members.
- A daily check flags accounts with abnormal activity (`answer_events` volume, many distinct IPs) and alerts by email/Slack.
**Decision needed:** whether Steve wants the alert job.

**Account sharing limits.** Supabase Auth has "single session per user" (a Pro plan setting): signing in on one device signs out the others. Trade-off: a member who uses a phone and a computer gets logged out on each switch. The alternative is detection only (the alert above). **Decision needed from Steve.**

**Backups.** Depends on the Supabase plan. Pro includes daily backups kept for 7 days; Point-in-Time Recovery is a paid add-on. To confirm with the PAT or the dashboard.

**Private reference-images bucket (F-009).** Limits and admin-only uploads are done (F-010). Making the bucket private needs FE work: reference markdown stores public image URLs, so the renderer must swap them for signed URLs, plus a one-off rewrite of the stored URLs to paths. Worth doing because those images are paid content (cheat sheets). **Needs Dejan's agreement.**

**CAPTCHA (F-012).** Waiting for Steve's Turnstile site key and secret, and for Dejan's ping that the site key is live in Vercel. Only then switch on CAPTCHA in Supabase Auth, or nobody can sign in.

**Not in this batch, deferred to pre-production as agreed:** F-011 CORS allow-list, F-007 seeded admin credential (being handled through #79), F-008 react-router bump.
