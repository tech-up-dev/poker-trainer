# Security batch #74 / #76 / #79 — BE runbook

Prepared 2026-10-16 on branch `be/security-batch-74-76-79`. Nothing below is applied to staging or prod yet.

## #74 Pro Training suppression not hiding an owned course

**Diagnosis (live prod data, 2026-10-16):**

- Suppression logic and data are correct. `stevepavilanistestone@gmail.com` has `purchased mc` in both GHL (live) and `member_ghl_tags` (synced 2026-10-16 06:00 UTC). The Controlled Chaos Masterclass row has `purchased mc` in `ghl_tags` (exact string match). `get_owned_courses` now returns the Masterclass as owned, and `ProTrainingPage` filters by `owned_course_ids`.
- Root cause is **sync latency**. `member_ghl_tags` is written only by:
  - `ghl-webhook`, which fires only on Steve's access-tag workflow, not on purchase tags.
  - `ghl-resync`, the daily cron at 06:00 UTC.
  
  A purchase tag added by hand in GHL therefore reached the app only at the next 06:00 UTC sweep, so Steve probably tested before it ran.

**Fix (staged on this branch):** `ghl-sync-me` now also records the caller's tags into `member_ghl_tags`. New body flag `{ "tags_only": true }` refreshes tags without touching the entitlement.

- **FE (Dejan):** on `/play/courses` mount, call `supabaseProd.functions.invoke('ghl-sync-me', { body: { tags_only: true } })` and wait for it before calling `get_owned_courses`. The page is then always current for the member viewing it.
- **Optional, Steve:** a GHL workflow on purchase-tag added → POST to `ghl-webhook`. That keeps tags fresh even when the member never opens Courses. Not required once the FE call above is live.

**Data notes for Steve:**

- Masterclass `ghl_tags` currently has `purchased mc`, `purchased mc bookfunnel 297`, `purchased mc bookfunnel 347` and `purchased mc upsell`. `purchased ft`, which was in his original list, is **not** set. Ask Steve whether that is intentional.
- Matching is exact and case-sensitive: `purchased mc` ≠ `Purchased MC` ≠ `purchased  mc`.

**Deploy:** `supabase functions deploy ghl-sync-me --project-ref ypbgytbdowfzyfikesfg` (prod is the only project the app calls). The change is additive: existing signup callers send no body and keep the old behaviour, plus the extra tag write.

## #79 Admin account + 2FA

**Live state (2026-10-16):**

- There is exactly one admin, `admin@domain.com` (id `ff22de52-…`), with no MFA factors. It was last signed in at 2026-10-16 03:54 UTC, so someone (likely Steve) uses it.
- `steve@beatsmallstakes.com` does not exist as a user, so the rename has no conflict.

**Email change (ready to run once Blagojche confirms):**

1. Run admin API `updateUserById('ff22de52-…', { email: 'steve@beatsmallstakes.com', email_confirm: true })`.
2. Send Steve a password reset, so `Administrator1!` (committed in the seed migration, F-007) stops working once he sets a new one.

Open question: do Blagojche, Dejan or Panche need their own admin logins after this? Renaming hands the only admin account to Steve.

**2FA (staged on this branch):** `_shared/admin.ts` `assertAdmin` now requires JWT `aal = aal2` when the env var `REQUIRE_ADMIN_MFA=true` is set. It ships **dark**: the env var is unset, so there is no behaviour change.

Recommended method: **TOTP (authenticator app)**. Supabase supports TOTP natively and it is enabled by default. "Email code" is not a Supabase MFA factor type; it would need custom code. Confirm with Steve.

Enable order:
1. Dejan ships the enrollment and challenge UI (`supabase.auth.mfa.enroll / challenge / verify`).
2. Steve enrolls.
3. Set `REQUIRE_ADMIN_MFA=true` on prod.

Doing this out of order locks the admin out.

## #76 Password reset emails + reset flow

**DNS checked 2026-10-16:** DKIM `resend._domainkey.auth` is present. SPF for `send.auth` (amazonses) is present. DMARC on `auth.` is `p=none`.

Authentication passes, so the spam placement is mostly content and link reputation. The current links point to `ypbgytbdowfzyfikesfg.supabase.co`, a different domain than the sender. Steve's fix addresses exactly that.

`https://trainer.beatsmallstakes.com` is live (HTTP 200, serves this app), so it can become the Site URL.

**Auth config patch** (needs a fresh Supabase PAT; always a FULL SMTP block, with the RAW `smtp_pass` and never the hash read back from GET; see the workflow memory):

```json
{
  "site_url": "https://trainer.beatsmallstakes.com",
  "uri_allow_list": "https://trainer.beatsmallstakes.com/**,http://localhost:5173/**",
  "smtp_admin_email": "support@auth.beatsmallstakes.com",
  "smtp_sender_name": "Controlled Chaos Trainer",
  "smtp_host": "smtp.resend.com",
  "smtp_port": "587",
  "smtp_user": "resend",
  "smtp_pass": "<RAW RESEND KEY>",
  "smtp_max_frequency": 60,
  "mailer_subjects_recovery": "Reset your Controlled Chaos Trainer password",
  "mailer_templates_recovery_content": "<Steve's PDF HTML; link = {{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery>",
  "mailer_templates_confirmation_content": "<... link = {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email>",
  "mailer_templates_magic_link_content": "<... link = {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email>",
  "mailer_templates_invite_content": "<... link = {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite>",
  "mailer_templates_email_change_content": "<... link = {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change>"
}
```

**Blockers / caveats:**

1. **Order matters.** Dejan's `/reset-password` "Continue → `verifyOtp({ token_hash, type: 'recovery' })`" must be live **before** the template switch. Otherwise every reset link breaks.
2. **Reply-To is not supported by Supabase Auth SMTP.** There is no reply-to field. Setting `Reply-To: support@lc.beatsmallstakes.com` needs either a Supabase "Send Email" auth hook that sends through the Resend API (with `reply_to`), or living without it. Flag to Steve.
3. **Steve's PDF HTML template** has not been received yet. It goes into the `*_content` fields above.
4. Signup confirmation is effectively unused (prod has `mailer_autoconfirm: true`). Magic link, invite and email change are not used by the app today either. Their templates are updated for consistency, but they need an `/auth/confirm` FE route (Dejan) if they are ever triggered.
5. **Removing the vercel.app address from the allow-list:** make sure `poker-trainer-olive-rho.vercel.app` redirects to the trainer domain in Vercel first. `post-purchase-signin` builds `redirectTo` from the request Origin, so a buyer arriving on the old domain would get a rejected redirect.
6. "Do not touch lc.beatsmallstakes.com" is respected: nothing here changes it.
