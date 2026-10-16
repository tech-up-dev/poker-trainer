# Supabase Auth email templates (#76)

Source: Steve's `trainer-password-reset-email-fixes.pdf`, pages 4-5 (recovery copy relayed by Blagojche 2026-10-16). The other four reuse the same style.

These go into the auth config PATCH in `security-batch-74-76-79.md`, together with `"mailer_otp_exp": 3600` (60 minutes, matching the copy).

**Caveats**

- Supabase Auth templates are HTML only. There is no plain-text template field, so the plain-text part needs the Send Email hook (the same hook that would add Reply-To).
- "Just reply to this email" only works with Reply-To. `auth.beatsmallstakes.com` has **no MX record**, so a reply to `support@auth.beatsmallstakes.com` bounces. Either ship the hook with `Reply-To: support@lc.beatsmallstakes.com`, or change that line of copy.
- Signup, magic link, invite and email change link to `/auth/confirm`. That FE route doesn't exist yet. Those flows aren't used today (`mailer_autoconfirm` is on), so this is only for consistency.

Button style, shared by all five templates:

```
display:inline-block;background:#F5A03A;color:#1A1206;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;
```

## Recovery

`mailer_subjects_recovery`: Reset your Controlled Chaos Trainer password

```html
<p>Hi,</p>
<p>We received a request to reset the password for your Controlled Chaos Trainer account ({{ .Email }}).</p>
<p><a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery" style="display:inline-block;background:#F5A03A;color:#1A1206;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;">Reset my password</a></p>
<p style="font-size:13px;color:#555;">If the button doesn't work, copy and paste this link into your browser:<br>{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery</p>
<p>This link expires in 60 minutes and can only be used once.</p>
<p>If you didn't ask to reset your password, you can ignore this email, your password won't change and your account is still secure.</p>
<p>Need help? Just reply to this email and we'll get you sorted out.</p>
<p>Thanks,</p>
<p>Steve Pavilanis<br>Beat Small Stakes, Controlled Chaos Trainer</p>
```

## Signup confirmation

`mailer_subjects_confirmation`: Confirm your Controlled Chaos Trainer account

```html
<p>Hi,</p>
<p>Thanks for signing up for Controlled Chaos Trainer. Please confirm your email address ({{ .Email }}) to finish setting up your account.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" style="display:inline-block;background:#F5A03A;color:#1A1206;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;">Confirm my email</a></p>
<p style="font-size:13px;color:#555;">If the button doesn't work, copy and paste this link into your browser:<br>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email</p>
<p>This link expires in 60 minutes and can only be used once.</p>
<p>If you didn't create this account, you can ignore this email.</p>
<p>Need help? Just reply to this email and we'll get you sorted out.</p>
<p>Thanks,</p>
<p>Steve Pavilanis<br>Beat Small Stakes, Controlled Chaos Trainer</p>
```

## Magic link

`mailer_subjects_magic_link`: Your Controlled Chaos Trainer sign-in link

```html
<p>Hi,</p>
<p>Here is your sign-in link for your Controlled Chaos Trainer account ({{ .Email }}).</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" style="display:inline-block;background:#F5A03A;color:#1A1206;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;">Sign in</a></p>
<p style="font-size:13px;color:#555;">If the button doesn't work, copy and paste this link into your browser:<br>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email</p>
<p>This link expires in 60 minutes and can only be used once.</p>
<p>If you didn't ask to sign in, you can ignore this email, your account is still secure.</p>
<p>Need help? Just reply to this email and we'll get you sorted out.</p>
<p>Thanks,</p>
<p>Steve Pavilanis<br>Beat Small Stakes, Controlled Chaos Trainer</p>
```

## Invite

`mailer_subjects_invite`: You're invited to Controlled Chaos Trainer

```html
<p>Hi,</p>
<p>You've been invited to Controlled Chaos Trainer. Accept the invite to set up your account ({{ .Email }}).</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite" style="display:inline-block;background:#F5A03A;color:#1A1206;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;">Accept invite</a></p>
<p style="font-size:13px;color:#555;">If the button doesn't work, copy and paste this link into your browser:<br>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite</p>
<p>This link expires in 60 minutes and can only be used once.</p>
<p>If you weren't expecting this invite, you can ignore this email.</p>
<p>Need help? Just reply to this email and we'll get you sorted out.</p>
<p>Thanks,</p>
<p>Steve Pavilanis<br>Beat Small Stakes, Controlled Chaos Trainer</p>
```

## Email change

`mailer_subjects_email_change`: Confirm your new Controlled Chaos Trainer email

```html
<p>Hi,</p>
<p>We received a request to change the email on your Controlled Chaos Trainer account from {{ .Email }} to {{ .NewEmail }}.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change" style="display:inline-block;background:#F5A03A;color:#1A1206;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;">Confirm email change</a></p>
<p style="font-size:13px;color:#555;">If the button doesn't work, copy and paste this link into your browser:<br>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change</p>
<p>This link expires in 60 minutes and can only be used once.</p>
<p>If you didn't ask for this change, ignore this email and your email address will stay the same.</p>
<p>Need help? Just reply to this email and we'll get you sorted out.</p>
<p>Thanks,</p>
<p>Steve Pavilanis<br>Beat Small Stakes, Controlled Chaos Trainer</p>
```
