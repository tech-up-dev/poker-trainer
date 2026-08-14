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
the client's email workflows can fire on them. Use these exact field keys.

| Field key                          | Type   | Meaning                                   | Example      |
| ---------------------------------- | ------ | ----------------------------------------- | ------------ |
| `contact.last_trained_date`        | date   | Date of the member's last training        | 2026-08-14   |
| `contact.current_streak`           | number | Consecutive active days                   | 7            |
| `contact.weakest_concept`          | text   | Current weakest concept (display name)    | C-Betting    |
| `contact.weekly_goal_progress`     | text   | Progress toward the weekly goal           | 3 of 5       |
| `contact.monthly_days_trained`     | number | Active days this calendar month           | 12           |

Writes retry on transient failure. `weakest_concept` is the concept **display
name** resolved at write time (the app stores concept slugs internally; see the
answer-event snapshot notes), so a later concept rename is reflected on the next
write.

## Access tag (M3-14 entitlements)

Single tag that represents active app access:

- `app_subscriber_active`

The app adds this tag when a subscription is active and removes it when the
subscription lapses or is cancelled. This tag is what drives who can enter the
app. Additional per-price-point tags can be added later if needed; one is enough
to launch.

## Inbound tag-change workflows

The client created two GHL workflows on their side:

1. Trigger: **Contact Tag added** — watching `app_subscriber_active`
2. Trigger: **Contact Tag removed** — watching `app_subscriber_active`

The **webhook action** inside each workflow (POST to our inbound endpoint) is the
only remaining piece and is filled in together with the client once the inbound
Edge Function is deployed and we have the public URL. Planned payload: contact
id, email, the tag, and whether it was added or removed.

Our inbound handler reconciles entitlements **add-only with a `source` field**,
and a periodic resync reconciles any missed webhook. On sync failure the course
is shown (fail-open).

## Notes

- Source of the field keys and tag: client-provided doc "GHL Custom Fields"
  (screenshots of each field/workflow in GHL), Aug 2026.
- The dual purchase path (M3-07) means a subscription created from the client's
  GHL sales page grants the same entitlement as an in-app Stripe purchase.
