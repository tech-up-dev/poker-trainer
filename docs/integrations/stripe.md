# Stripe integration reference

Authoritative record of the Stripe configuration the app's subscription billing
depends on. The client owns the Stripe account. These IDs are the client's, and
must match the account whose API key we hold and that is connected to the
client's GoHighLevel location (see `ghl.md`).

## Account wiring (must stay true)

- The Stripe account holding these prices is the **same account** as the API key
  we were given. Stripe will not start a checkout with a price from a different
  account.
- That account is the one connected to GoHighLevel location
  `X9YN3cpdM3TwR2niCEmk`. A successful subscription applies the
  `app_subscriber_active` tag (and removal on cancellation), which is what
  actually unlocks the app.

## Secrets (never in the repo)

- The Stripe **secret key** (sandbox now, live at go-live) lives in the Edge
  Function environment **server-side only**. Never in `VITE_` vars, never in the
  client bundle, never committed here.
- Delivered via one-time link. At go-live, swap the sandbox key and test price
  IDs for the live ones **from the same account**.

## Test product and prices (sandbox)

One product, many prices. Every price grants the **same** app access (M3-04):
adding, changing or retiring a price needs no code change or deploy.

Product: `prod_V62YK0fB9siL8E` — "Beat Small Stakes Trainer App"

| Plan       | Amount    | Price ID                          |
| ---------- | --------- | --------------------------------- |
| Monthly    | $37/month | `price_1U5qTE014e1UrpFzAkmbcCd7`  |
| Monthly    | $47/month | `price_1U5qTE014e1UrpFzTppaHhYg`  |
| Monthly    | $57/month | `price_1U5qTE014e1UrpFz5riTevmd`  |
| Monthly    | $67/month | `price_1U5qTE014e1UrpFzjXiYhpzH`  |
| Annual     | $397/year | `price_1U5qTE014e1UrpFz0s8ps3zo`  |
| Annual     | $497/year | `price_1U5qTE014e1UrpFzEG6CVuXJ`  |
| Annual     | $597/year | `price_1U5qTE014e1UrpFzCZWKmxrm`  |
| Annual     | $697/year | `price_1U5qTE014e1UrpFzZEsCce0j`  |

These are **sandbox** IDs. Production IDs will differ and get swapped in at
go-live.

## Access rules the build must honor

1. **Single access level.** Every price unlocks the same thing via
   `app_subscriber_active`. There is no feature-differentiated "pro" tier. Do not
   gate any feature on which price was paid. A genuine higher tier, if ever
   wanted, is separate scope.
2. **Access is tag/entitlement driven, never Stripe status or amount.** The app
   grants access whenever the entitlement/tag is present, regardless of the
   dollar amount or whether Stripe reports the subscription as `trialing` vs
   `active`. Promotions (e.g. $97 for the first two months) are built entirely in
   GoHighLevel and sit in `trialing` while paid; they must still get full access.
3. **Trialing counts as active on the in-app path too.** When the in-app Stripe
   webhook grants an entitlement, treat `trialing` the same as `active`, so an
   in-app trial is never wrongly denied.

## Purchase paths

- **In-app checkout** consumes the price IDs above (cards and wallets: Apple Pay,
  Google Pay, Link). On success the entitlement is granted and GHL is kept in
  sync.
- **GoHighLevel sales page / promos** grant the same access via the
  `app_subscriber_active` tag (dual purchase path, M3-07). Buy-now-pay-later
  methods (Afterpay, Klarna) and Cash App live on this path, since Stripe does
  not offer them for recurring subscriptions.

## Notes

- Source: client Slack messages, Aug 2026. Client set up the test product/prices
  directly in Stripe; production products may later be created in GHL and pushed
  to Stripe automatically, to be settled at go-live.
