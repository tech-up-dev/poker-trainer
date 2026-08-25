-- M3 follow-up item 1 (pay-first + admin price editor). Admin-managed catalog of
-- Stripe prices the app offers to buyers. One product on Steve's side (all prices
-- grant the same quiz_app_access); this table decides which prices the plans page
-- surfaces and lets him edit / disable them without a code deploy.
--
-- Soft-delete via `enabled` (Stripe refuses to delete a price that has ever been
-- used, so we never DELETE - admin flips enabled=false and it disappears from the
-- plans page while existing subscribers on that price keep billing normally).

create table stripe_prices (
  id          uuid primary key default gen_random_uuid(),
  price_id    text not null unique,         -- Stripe price_1U5qTE... id (source of truth for checkout)
  label       text not null,                -- 'Monthly $37', 'Annual $497' - what the plans page shows
  amount      integer not null,             -- price in whole USD, purely for the label; Stripe holds the real amount
  interval    text not null check (interval in ('month', 'year')),
  enabled     boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger stripe_prices_set_updated_at
  before update on stripe_prices
  for each row execute function set_updated_at();

alter table stripe_prices enable row level security;

-- Public-readable for enabled prices - the plans page runs pre-account (anonymous
-- session) and needs the list. Disabled prices are admin-only.
create policy "public read enabled prices"
  on stripe_prices for select
  to anon, authenticated
  using (enabled = true);

create policy "admin read all prices"
  on stripe_prices for select
  to authenticated
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

-- Writes are service-role only (via the admin-prices Edge Function).

-- Seed the 8 sandbox prices from Steve's setup (previously hardcoded in
-- src/lib/checkout.ts). Product prod_V62YK0fB9siL8E. Monthly first (lowest to
-- highest), then annual - the sort_order matches display order.
insert into stripe_prices (price_id, label, amount, interval, sort_order) values
  ('price_1U5qTE014e1UrpFzAkmbcCd7', 'Monthly $37',  37,  'month', 10),
  ('price_1U5qTE014e1UrpFzTppaHhYg', 'Monthly $47',  47,  'month', 20),
  ('price_1U5qTE014e1UrpFz5riTevmd', 'Monthly $57',  57,  'month', 30),
  ('price_1U5qTE014e1UrpFzjXiYhpzH', 'Monthly $67',  67,  'month', 40),
  ('price_1U5qTE014e1UrpFz0s8ps3zo', 'Annual $397',  397, 'year',  50),
  ('price_1U5qTE014e1UrpFzEG6CVuXJ', 'Annual $497',  497, 'year',  60),
  ('price_1U5qTE014e1UrpFzCZWKmxrm', 'Annual $597',  597, 'year',  70),
  ('price_1U5qTE014e1UrpFzZEsCce0j', 'Annual $697',  697, 'year',  80);
