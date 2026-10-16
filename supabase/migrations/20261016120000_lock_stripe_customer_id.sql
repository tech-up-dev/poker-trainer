-- #77 / audit F-003: a member could set their own user_profiles.stripe_customer_id
-- to someone else's Stripe customer and open the billing portal as them.
--
-- stripe_customer_id is written only by Edge Functions (stripe-webhook,
-- post-purchase-signin) with the service role, which is unaffected. Members may
-- still update their own name; the "own profile update" RLS policy still limits
-- that to their own row.
revoke update on user_profiles from anon, authenticated;
grant update (full_name, updated_at) on user_profiles to authenticated;
