-- Pro Training admin UI already had a "CTA button text" field that the Pro
-- Training page was reading, but pro_training_courses never carried the column
-- so every save silently dropped it and the UI reverted to the "Order Now"
-- default on the next render. Add the column so admin saves persist.
--
-- Safe to re-run (`if not exists`). Existing rows keep "Order Now" via the
-- default. No RLS change needed: the existing select/insert/update/delete
-- policies on pro_training_courses already apply column-wise, and the
-- authenticated SELECT policy is wide enough to read the new column too.
--
-- Dejan: FE already sends `cta_text` on save in the next deploy.

alter table pro_training_courses
  add column if not exists cta_text text not null default 'Order Now';
