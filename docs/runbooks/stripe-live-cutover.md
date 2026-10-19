# Stripe live cutover (#8)

Prod Supabase project `ypbgytbdowfzyfikesfg`. Prepared 2026-10-19.

## What Steve sets up in Stripe (LIVE mode)

1. **Webhook endpoint:** `https://ypbgytbdowfzyfikesfg.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Send us the endpoint's signing secret (`whsec_...`) privately.
2. **Restricted key (`rk_live_...`) permissions:**
   - Checkout Sessions: **Write** (create + retrieve)
   - Customer portal: **Write** (billing portal sessions)
   - Customers: **Write** (the webhook reads the customer; Write avoids edge cases when Checkout reuses one)
   - Subscriptions: **Write** (the webhook reads subscriptions; admin delete user #80 cancels them)
   - Prices and Products: not needed by our code.
3. **Customer portal in live mode:** Settings → Billing → Customer portal → activate. Portal settings are separate for test and live mode, so the "Manage billing" button fails in live mode until this is saved.
4. The publishable key (`pk_live_...`) is **not needed**. Checkout redirects to Stripe's hosted page.

## What we do (one sitting, after the whsec_ arrives)

1. Edge Function secrets on prod: `STRIPE_SECRET_KEY` = `rk_live_...`, `STRIPE_WEBHOOK_SECRET` = `whsec_...` (`supabase secrets set --project-ref ypbgytbdowfzyfikesfg ...`).
2. Price catalog, in one transaction. Turn off the 8 sandbox prices and add the 2 live ones. Amounts are read from Stripe with the live key.
   ```sql
   begin;
   update stripe_prices set enabled = false where price_id like 'price_1U5qTE%';
   insert into stripe_prices (price_id, label, amount, interval, enabled, sort_order) values
     ('price_1URiY4014e1UrpFzIrBjIA3x', 'Monthly $67', 67, 'month', true, 10),
     ('price_1URibj014e1UrpFzMTnOmt8g', 'Annual $670', 670, 'year',  true, 20);
   commit;
   ```
3. Clear sandbox customer ids: `update user_profiles set stripe_customer_id = null where stripe_customer_id is not null;`. All current ids are test-mode customers that don't exist in live mode. Without this, a returning test user's checkout fails with "No such customer".
4. Smoke test: one real purchase with a real card on the monthly price, check access and the billing portal, then refund in Stripe.

## Status 2026-10-19

- `rk_live` received and checked read-only: Checkout Sessions, Customers, Subscriptions and the billing portal all work. The live portal is active. Live prices are $67/month and $670/year.
- Steve already created the live endpoint at our URL (enabled) with the 4 events above. Still needed from him:
  - the `whsec_`;
  - adding `charge.refunded` and `charge.dispute.created` to the endpoint, so a refund or chargeback revokes access;
  - adding **Invoices: Read** to the restricted key, so we can tell a trainer refund from one for his other products.
- **Guard (deployed 2026-10-19):** Steve's live account also sells his other products, so `stripe-webhook` and `post-purchase-signin` only act on subscriptions whose price is in `stripe_prices`. Everything else is ignored. Without this, any of his other Stripe sales would have created trainer accounts with access.

## Notes

- Do steps 1 and 2 together. A live price with a sandbox key (or the reverse) fails at checkout.
- Existing sandbox test subscriptions keep their entitlement until `expires_at`. Their Stripe events stop once the webhook secret changes.
