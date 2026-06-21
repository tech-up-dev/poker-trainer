# Client Dependencies

Everything we need from the client (Steve / Bushwood Digital Inc.) to deliver the Poker Trainer V1 build. Organized by when each item is needed and what blocks if it's missing.

This is a living document: items get checked off as they land, new items get added if dependencies emerge.

---

## Quick reference (by status)

| Status | Count |
|--------|-------|
| Done | _populate as items land_ |
| In progress | _populate_ |
| Pending (not yet needed) | _populate_ |
| Pending (needed soon) | _populate_ |
| Blocked (delaying work) | _populate_ |

Review this status table at every weekly call.

---

## Accounts and access

### GitHub repository
- **What:** A GitHub repository under the client's account, with developer added as a collaborator
- **Why:** Source of truth for all code, PRs, issues, and version history
- **When needed:** Pre-M1 kickoff (already provided)
- **Status:** Done. Repo at https://github.com/beatsmallstakes/beat-small-stakes-app
- **Notes:** Developer pushed all branches and history. Steve has US developer friends with collaborator access for review.

### Supabase accounts
- **What:** Access to two Supabase projects (staging and production) with admin privileges for both
- **Why:** Database, auth, edge functions, storage all live here. Two projects from day one for staging-first safety.
- **When needed:** Already established for development; client access for verification
- **Status:** Invites sent to steve@bushwooddigital.com for both projects
- **Notes:**
  - Production project must be on the **Pro plan** before production launch (daily backups, 100MB DB starting, customer support tier)
  - Staging can stay on Free plan
  - Both projects in the same region (recommended: us-east-1 or closest US region)

### Vercel account
- **What:** Vercel account with the project imported, builds running, and the custom domain attached
- **Why:** Hosts the deployed app, handles SSL, provides one-click code rollback
- **When needed:** Custom domain attachment by M4 deploy; earlier if staging subdomain is wanted
- **Status:** Pending
- **Notes:**
  - Free plan supports the project initially
  - Pro plan recommended once production is live (advanced analytics, longer log retention)
  - Vercel automatically handles SSL via Let's Encrypt

### Stripe account
- **What:** Stripe account with test mode keys (for development) and live mode keys (for production)
- **Why:** Subscription billing
- **When needed:** M3 start
- **Status:** Pending
- **Notes:**
  - Required: Stripe products set up for each price point (e.g., $27/mo standard, $47/mo, annual)
  - All Stripe price IDs to be shared with developer for entitlement mapping
  - Webhook endpoint will be configured in Stripe dashboard once Edge Function is deployed
  - Stripe webhook secret to be provided to developer

### GoHighLevel account
- **What:** GHL account with API access enabled
- **Why:** Real-time CRM sync of subscription events
- **When needed:** M3 start
- **Status:** Confirmed standard Stripe-backed setup (no native processing). API access still needed.
- **Notes:**
  - API key needs to be generated in GHL and shared with developer
  - GHL location ID needs to be shared
  - Custom fields in GHL contact records may need to be created (e.g., subscription_status, plan, current_period_end)
  - Tag taxonomy in GHL should be agreed (e.g., quiz_app_subscriber, quiz_app_cancelled)

### Domain and DNS
- **What:** A registered domain name plus DNS access (or willingness to add records when needed)
- **Why:** The app needs to live somewhere members can reach it
- **When needed:** M4 production deploy (or earlier if staging subdomain is desired)
- **Status:** Pending
- **Notes:**
  - Suggested structure: `app.<brand-domain>.com` for production, optionally `staging.<brand-domain>.com` for staging preview
  - Vercel provides DNS records to add (typically a CNAME)
  - SSL is auto-issued by Vercel
  - If using a brand-new domain, register with at least 1-year auto-renewal

### Email sender (transactional)
- **What:** A transactional email provider account (Resend, SendGrid, Postmark, or similar) configured with the brand domain for sending password reset and notification emails
- **Why:** Supabase's default email sender works but uses a Supabase-branded "from" address. For production, members should receive emails from the brand domain.
- **When needed:** M3 (when auth flows go live)
- **Status:** Pending
- **Notes:**
  - SMTP credentials to be added to Supabase Auth settings
  - DKIM, SPF, and DMARC records required on the brand domain
  - Recommended: Resend (developer-friendly) or Postmark (high deliverability)

---

## Credentials and keys

### Stripe keys
- Publishable key (test mode): for development
- Secret key (test mode): for Edge Function secrets in development
- Publishable key (live mode): for production
- Secret key (live mode): for production Edge Function secrets
- Webhook signing secret: for verifying Stripe webhook authenticity

**Format expected:**

```
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe product/price IDs
- Each Stripe product (price) the client wants to offer needs a Price ID shared with the developer
- Example: `price_1AbC...` for $27/mo, `price_2XyZ...` for $47/mo
- All map to the same `quiz_app_access` entitlement; no code change needed when new prices are added in Stripe later

### GoHighLevel keys and IDs
- API key (from GHL → Settings → Business Profile → API)
- Location ID (visible in GHL URL)
- Pipeline IDs (if subscription stages map to pipeline stages)

**Format expected:**

```
GHL_API_KEY=...
GHL_LOCATION_ID=...
```

### Supabase keys
- Already in hand for both projects (developer manages these via the Supabase dashboards). Client doesn't need to share; client has access to view via the dashboards.

### Email sender credentials
- SMTP host, port, username, password (or API key, depending on provider)

### VAPID keys (web push)
- Generated once by the developer for M4
- Public key goes in client-facing env
- Private key goes in Supabase Edge Function secrets

---

## Content and methodology

### The five Controlled Chaos principles
- **What:** Final names for the five core teaching principles, used as `principle_tag` values throughout content
- **When needed:** Locked into the codebase post-M1 demo. Pre-M2 to maintain content integrity.
- **Status:** Done (provided June 13)
- **Values:**
  1. Character Mapping
  2. Strategic 3-Betting
  3. Simple Math for Big Stacks
  4. Floating and Equity Flow
  5. Building and Winning Huge Pots

### The six Character Mapping player types
- **What:** Final names and short codes for the six player types
- **When needed:** Locked into the codebase early for schema correctness
- **Status:** Done (provided June 13, with correction June 14)
- **Values:**
  1. Old Man Coffee (OMC)
  2. Passive Loose Fish (PLF)
  3. Y2K Tag (Y2K)
  4. GTO Boy (GTO)
  5. Drunk Whale Maniac (DWM)
  6. Smart Thinking Player (STP)

### Concept taxonomy (seed values)
- **What:** Starting set of concept identifiers used in lessons; client extends through CMS as content grows
- **When needed:** Schema doc references these; seeded by M2
- **Status:** Done (20 seed concepts provided June 13)
- **Values (initial 20):**
  1. 3-Bet Sizing
  2. Core 34
  3. 3-Betting Light
  4. Value 3-Betting
  5. Isolating Limpers
  6. Building Table Image
  7. Character Mapping
  8. Implied Odds
  9. Pot Odds
  10. Equity Flow
  11. Floating
  12. Hand Reading
  13. Value Betting
  14. Bet Sizing
  15. Pot Control
  16. Blockers
  17. In Position
  18. Out of Position
  19. Stack to Pot Ratio (SPR)
  20. Continuation Betting
  21. Table Image

Notes: list has minor numbering quirk (two #19s in the original list, treat as 21 values).

### Content for M1 demo
- **What:** A handful of real lessons authored by the client for demo content in M1
- **When needed:** Before M1 demo
- **Status:** Pending (placeholder content currently in samples)
- **Notes:** Even 3-5 real lessons makes the M1 demo feel like a real product rather than a prototype

### Content for production launch
- **What:** Per the PRD, minimum 50 lessons at launch
- **When needed:** Before production launch (post-M4)
- **Status:** Client-authored in parallel with development
- **Notes:**
  - Client uses Claude with the schema doc to generate batches
  - Bulk import (M1 deliverable) lets client load batches via the validator
  - Versioning lets client publish, review, and rollback as needed during content build-out

### Glossary content
- **What:** Initial glossary entries (terms and definitions) for the in-drill tap-to-define feature
- **When needed:** Before M2 demo
- **Status:** Pending
- **Notes:**
  - Glossary is a managed table in Supabase
  - Each entry: term, plain-language definition, importance indicator, situation-specific example, related terms for nested linking
  - Client authors directly through the CMS or via the same bulk import mechanism

### Tips library content
- **What:** Daily tip content for the Today's Tip rotation
- **When needed:** Before M2 (rotation goes live in M4 dashboard)
- **Status:** Pending
- **Notes:** Same content pipeline as lessons; same bulk-import path

### References Library content
- **What:** Cheat sheets, Character Mapping reference, methodology references
- **When needed:** Before M4 launch
- **Status:** Pending
- **Notes:** Same content pipeline

### Skills Path structure
- **What:** Definition of the skill nodes, their relationships, and prerequisites
- **When needed:** M4 (Skills Path implementation)
- **Status:** Pending
- **Notes:**
  - Client defines the topology (which skills, what depends on what)
  - Developer builds the visualization
  - Initial set can be small (10-15 nodes) and grow over time

---

## Design assets

### Six player-type avatar artwork
- **What:** SVG illustrations of the 6 player types as small, simple avatars for use at the static poker table
- **When needed:** M4 polish (placeholders work fine until then)
- **Status:** Pending (designer being hired by client)
- **Notes:**
  - **Format:** SVG (vector) primary, PNG transparent at 2x/3x as backup
  - **Base size:** 80x80 px target render at the table; must read clearly down to roughly 40x40 for mobile thumbnails
  - **Style:** flat, simple, distinct silhouettes. Recognizable at thumbnail size. Memoji simplicity, not detailed illustration.
  - **Background:** transparent
  - **File naming:** matches the codes
    - `omc.svg`
    - `plf.svg`
    - `y2k.svg`
    - `gto.svg`
    - `dwm.svg`
    - `stp.svg`

### Logo
- **What:** Brand logo for use in the app header, PWA install icon, and favicon
- **When needed:** M4 polish (neutral defaults until then)
- **Status:** Pending (designer being hired by client)
- **Notes:**
  - **Format:** SVG primary, PNG transparent at 512x512, 256x256, 64x64 as backup
  - **Variations:** full color + monochrome. Light/dark variants if applicable.
  - **Background:** transparent
  - **Favicon version:** logomark (square, not full wordmark) for the PWA app icon and browser tab

### Brand colors
- **What:** Primary, secondary, accent colors plus neutrals
- **When needed:** M4 polish
- **Status:** Pending
- **Notes:**
  - Provide as hex codes or a Figma/Sketch style guide
  - The build uses thoughtful neutral defaults (slate, white, accent blue) until brand colors arrive
  - Integration is a deliberate pass: typography, color system, spacing rhythm. Not a search-and-replace.

### Brand fonts
- **What:** Web fonts to use across the app
- **When needed:** M4 polish
- **Status:** Pending
- **Notes:**
  - Specify font family names and weights needed
  - If self-hosted, provide WOFF2 files
  - If from Google Fonts or similar, just the names

### Marketing assets (optional)
- **What:** Hero images, illustrations, promotional graphics if used in onboarding or dashboards
- **When needed:** As specific UI is built
- **Status:** Pending
- **Notes:** Most V1 screens don't need marketing assets; functional UI carries the experience

---

## Business decisions

### Pricing tiers
- **What:** Final list of subscription price points and what each maps to (all map to the same access entitlement; price points are revenue/marketing choices)
- **When needed:** M3 (entitlement model setup)
- **Status:** Pending
- **Notes:**
  - Confirmed: all prices map to the same `quiz_app_access` entitlement
  - Confirmed: admin can add/change prices anytime without code changes
  - Initial set might be: $27/mo standard, $47/mo (loyalty/donor tier), $297/year, occasional promo prices

### Subscription business rules
- **What:** Behavior on failed payments, cancellations, refunds, trial periods
- **When needed:** M3
- **Status:** Pending
- **Notes:**
  - Failed payment: how many retries, grace period before access is revoked
  - Cancellation: access until end of paid period, or immediate revocation?
  - Trial: any free trial offered? (Adds complexity; default no trial)
  - Refunds: policy and Stripe-side handling

### GoHighLevel tag taxonomy
- **What:** Names of tags and custom fields in GHL that the sync should update
- **When needed:** M3
- **Status:** Pending
- **Notes:**
  - Recommend simple, descriptive names: `quiz_app_active`, `quiz_app_cancelled`, `quiz_app_payment_failed`
  - Custom fields: `quiz_app_plan`, `quiz_app_status`, `quiz_app_period_end`

### Content publishing rules
- **What:** Who can promote content to production, who can rollback, any approval process
- **When needed:** M2 (admin auth gating)
- **Status:** Pending
- **Notes:**
  - V1 default: client has admin access; can promote and rollback directly
  - No multi-step approval workflow in V1 (V2+ if needed)

### Push notification rules
- **What:** When are streak reminder pushes sent, what content do they contain
- **When needed:** M4
- **Status:** Pending
- **Notes:**
  - Recommend: daily reminder at <time> if user hasn't completed a session that day and has an active streak at risk
  - Member can opt out via settings
  - Time zone handling: send at user's local time (use user_streaks.timezone field, added in M4 migration)

### Onboarding flow specifics
- **What:** Step-by-step flow content for first-login onboarding
- **When needed:** M4
- **Status:** Pending
- **Notes:**
  - 3-5 screens: welcome, "how it works," pick a starting topic, first drill
  - Content authored by client; developer builds the flow

### Leaderboard rules
- **What:** What metric drives the monthly leaderboard ranking, how ties are broken, what rewards are given
- **When needed:** M4
- **Status:** Pending
- **Notes:**
  - Default ranking: total points earned in the month
  - Ties: secondary sort by accuracy rate
  - Rewards: client mentioned "private coaching call for top 3" — exact rewards not part of build, just leaderboard display

---

## Legal and operational

### Legal / IP agreement
- **What:** A signed agreement between client and developer covering IP ownership, non-compete, and confidentiality
- **When needed:** Early in the project (anytime before final delivery)
- **Status:** Pending (client to draft)
- **Notes:**
  - Client mentioned: "very standard stuff that just says I'll own the app going forward, you can't resell it to a competitor, etc."
  - Developer to review before signing
  - Once signed, store both parties' copies

### Privacy policy
- **What:** Privacy policy URL, posted on the client's website, that the app links to (per GDPR, CCPA requirements)
- **When needed:** Before production launch
- **Status:** Pending (client owns this)

### Terms of service
- **What:** ToS URL for the app, posted on the client's website
- **When needed:** Before production launch
- **Status:** Pending (client owns this)

### Age verification
- **What:** Age filter (or attestation) at signup; poker content typically requires 18+ in many jurisdictions, 21+ in others
- **When needed:** M3 (signup flow)
- **Status:** Pending
- **Notes:**
  - Recommend a simple "I am 18+" checkbox at signup (or 21+ if client prefers)
  - Real ID verification not needed unless legal counsel advises

### Data deletion request handling
- **What:** Process for handling member requests to delete their data (GDPR, CCPA)
- **When needed:** Before launch
- **Status:** Pending
- **Notes:**
  - Likely informal in V1: client receives email request, manually removes user from Supabase
  - Could automate in V2+ with a "delete my account" button

---

## Communication and operational

### Slack channel
- **What:** A Slack channel for async communication
- **When needed:** Early in the project
- **Status:** Pending (client to set up after the first call)
- **Notes:** Once set up, client sends invite to developer email

### Calendar slots
- **What:** Recurring weekly call slot
- **When needed:** Ongoing
- **Status:** Confirmed Thursday 5 PM Skopje (10 AM Chicago)
- **Notes:** Steve hosts on Zoom, records and shares

### Designer contact (if direct)
- **What:** If the developer needs to communicate directly with the designer about asset specs, contact details
- **When needed:** Around M4 when assets are being created
- **Status:** Communication flows through Steve currently
- **Notes:** Specs documented in this file and in the message to Steve dated June 13

---

## Dependency timeline summary

A condensed view of when each item is critical:

| Item | Critical by | Status |
|------|-------------|--------|
| GitHub repo + access | Pre-M1 | Done |
| Supabase access (both projects) | Pre-M1 | Done (invites sent) |
| 5 principle names | M1 | Done |
| 6 player type names | M1 | Done (corrected June 14) |
| 20 seed concepts | M1 | Done |
| Stripe account + keys | M3 start | Pending |
| GHL API key + location ID | M3 start | Pending |
| Email sender credentials | M3 start | Pending |
| Vercel + domain access | M4 deploy | Pending |
| Custom domain registered | M4 deploy | Pending |
| Pricing tiers and subscription rules | M3 | Pending |
| GHL tag taxonomy | M3 | Pending |
| 6 avatar SVGs | M4 polish (placeholders OK until then) | Pending |
| Logo SVG | M4 polish | Pending |
| Brand colors and fonts | M4 polish | Pending |
| 50+ lessons of content | Before launch | Client authoring |
| Glossary content | Before M2 demo | Pending |
| Tips library content | Before M4 | Pending |
| References Library content | Before launch | Pending |
| Skills Path topology | M4 | Pending |
| Push notification rules | M4 | Pending |
| Onboarding flow content | M4 | Pending |
| Leaderboard rules | M4 | Pending |
| Legal / IP agreement | Anytime, ideally early | Drafting (client) |
| Privacy policy URL | Before launch | Pending |
| Terms of service URL | Before launch | Pending |
| Slack channel | Early | Pending |

Review and update this table at every weekly call. Anything that moves from Pending to Done gets noted; anything newly Blocked gets escalated.

---

## How to use this document

1. **At project kickoff:** walk through the document with the client, confirm everything that's already done, schedule deadlines for everything pending.
2. **At weekly calls:** scan the table at the bottom. Anything pending that's needed soon gets escalated.
3. **When something arrives:** mark it Done in this document, commit the update.
4. **When new dependencies emerge:** add them to the document with a clear "needed by" milestone.
5. **At milestone reviews:** verify no needed-by-this-milestone items are still Pending. If any are, that's a project status conversation.

This document is the single source of truth for "what does the developer need from the client." When in doubt, refer here.
