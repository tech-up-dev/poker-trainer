-- M3-10: managed concept vocabulary.
--
-- One admin-managed list of concept tags (12-20 to start). It feeds the lesson-
-- and question-tag dropdowns, and is the allow-list the pipeline validates a
-- question's concept against (M3-09) so there is no free-text tagging anywhere.
--
-- slug is the stable identity stored on content (immutable); name is the editable
-- display label. Renaming a concept changes name, never slug, so existing content
-- keeps pointing at the same concept.
create table if not exists concepts (
  slug        text        primary key,
  name        text        not null,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

alter table concepts enable row level security;

-- Any authenticated user may read the vocabulary (the wizard/dropdowns need it).
create policy "concepts_select"
  on concepts for select
  using (auth.role() = 'authenticated');

-- Only signed-in admins (active admin_access entitlement) may manage it — same
-- gate as content_staging / app_settings. Service role bypasses RLS as usual.
create policy "concepts_admin_insert"
  on concepts for insert
  with check (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

create policy "concepts_admin_update"
  on concepts for update
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

create policy "concepts_admin_delete"
  on concepts for delete
  using (
    exists (
      select 1 from entitlements e
      where e.user_id = auth.uid()
        and e.entitlement_key = 'admin_access'
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );

-- Seed the placeholder "Test" concept. Existing content maps onto it during
-- migration (M3-12); it is a normal, deletable row once that content is cleared.
insert into concepts (slug, name, sort_order) values ('test', 'Test', 0)
on conflict (slug) do nothing;
