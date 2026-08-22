# GoHighLevel integration reference

Authoritative record of the GoHighLevel (GHL) configuration the app depends on.
The client owns and manages the GHL sub-account; we do **not** have sub-account
access and are not getting it. Everything below was created by the client on
their side, and these keys/names must be used verbatim by the app.

Sub-account / Location ID: `X9YN3cpdM3TwR2niCEmk`

## Authentication

- Reads and writes use the client's **Private Integration token** (Contacts
  read/write, Tags read). The token has **no webhook scope**, and none is needed.
- The token is a secret. It lives **server-side only** (Edge Function env), never
  in `VITE_` vars or any client bundle.

## Contact custom fields (M3-13 write-back)

The app writes these member-behaviour fields back to the member's GHL contact so
the client's email workflows can fire on them.

**Write by field ID, not by merge-key.** GoHighLevel v2 writes custom fields by
their internal **field ID**. The `contact.xxx` names are template/merge keys, not
the API write reference — writing by them returns `200` but is silently ignored.
The Private Integration token needs the `locations/customFields.readonly` scope to
resolve IDs (added by the client Aug 2026). The IDs below are the write reference.

| Field key                      | Field ID (write reference) | Type   | Meaning                                | Example    |
| ------------------------------ | -------------------------- | ------ | -------------------------------------- | ---------- |
| `contact.last_trained_date`    | `pgkLNSFAeJW0xRGjKhq7`     | date   | Date of the member's last training     | 2026-08-14 |
| `contact.current_streak`       | `5rVKcvwUA4mnSS3w1uBm`     | number | Consecutive active days                | 7          |
| `contact.weakest_concept`      | `ekiDsFazDVtGFsOEfL5c`     | text   | Current weakest concept (display name) | C-Betting  |
| `contact.weekly_goal_progress` | `Lt4zLukTOJsSd5MWK7pv`     | text   | Progress toward the weekly goal        | 3 of 5     |
| `contact.monthly_days_trained` | `33u2it1ES8QWRI4SLw5B`     | number | Active days this calendar month        | 12         |

The push currently writes `last_trained_date` and `current_streak` (E2E-verified
populating a live contact). The other three light up once the M4/M5 data behind
them exists. Writes retry on transient failure. `weakest_concept` is the concept
**display name** resolved at write time (the app stores concept slugs internally;
see the answer-event snapshot notes), so a later concept rename is reflected on the
next write.

## Access tag (M3-14 entitlements)

Single tag that represents active app access:

- `app_subscriber_active`

This tag is what drives who can enter the app, and it is applied from two
directions:

- **In-app purchase (M3-06):** on a successful Stripe purchase the `stripe-webhook`
  upserts the buyer's GHL contact by email and applies `app_subscriber_active`
  (removing it on cancel). This is what makes the client's email workflows fire for
  in-app buyers, not just funnel buyers. Best-effort: it never blocks the in-app
  entitlement grant, which happens directly regardless. E2E-verified on prod
  (purchase -> tagged, cancel -> untagged). The client's native Stripe-GHL
  connection does **not** create the contact, so the function must.
- **Funnel / promo purchase:** the client's GHL automation applies the tag, which
  our `ghl-webhook` reconciles into an entitlement.

Additional per-price-point tags can be added later if needed; one is enough to
launch.

## Inbound tag-change workflows

The client created two GHL workflows on their side:

1. Trigger: **Contact Tag added** — watching `app_subscriber_active` (grants)
2. Trigger: **Contact Tag removed** — watching `app_subscriber_active` (revokes)

Each workflow's **webhook action** POSTs to `/functions/v1/ghl-webhook`,
authenticated with the `x-webhook-secret` header, payload: contact id, email, the
tag, and whether it was added or removed. This is **live and verified end to end**
on prod (a real tag add granted access, a real tag remove revoked it).

Our inbound handler reconciles entitlements **add-only with a `source` field**,
and a periodic resync reconciles any missed webhook. On sync failure access is
left in place (fail-open), so a transient outage never revokes a paying member.

## Notes

- Source of the field keys and tag: client-provided doc "GHL Custom Fields"
  (screenshots of each field/workflow in GHL), Aug 2026.
- The dual purchase path (M3-07) means a subscription created from the client's
  GHL sales page grants the same entitlement as an in-app Stripe purchase.
