# Changelog

All notable changes to this project are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/). Release tags are cut on
`master` at each milestone sign-off, named `v1.0.0-m1`, `v1.0.0-m2`, and so on.
Work that has landed but whose milestone is not yet signed off lives under
[Unreleased].

## [Unreleased]

### M2 - Quiz Engine, CMS Backbone, Tips/References (in progress)

- Content pipeline generalized to `content_staging` / `content_published` /
  `content_versions` with a `content_type` discriminator, so one
  validate -> stage -> promote -> rollback flow serves lesson, glossary, tip,
  reference, and path_node.
- Admin editors for Tip, Reference, and Glossary content types.
- Auto-generated content ids (slugged from title/term) when the author omits
  one, reusing the id for identical data and suffixing on a real collision.
- Bulk Import: content-type auto-detection, one-key wrapper unwrapping
  (`{ "glossary": [ ... ] }`), and one-click bulk promote.
- Staging browser: list, view, edit, promote, and export staged content by type.
- Side-by-side Staging and Production panels in every editor.
- Versioning: preview the content captured at any prior version, and rollback,
  across all content types.
- Server-side Zod re-validation on both promote and rollback (final gate).
- Lossless JSON export (round-trips through Bulk Import) from the staging
  browser, the editor panels, and the version history.
- Per-user state schema: `user_progress`, `user_streaks`,
  `user_saved_questions`, `user_saved_tips`, `user_badges` with owner-only RLS.
- Tooling: TypeScript strict mode, Prettier, and a lint rule banning em dashes.

### M1 - Foundation, Static Table, Q&A, Glossary, PWA (in progress)

- Admin authentication (production project), route guard, and RLS lockdown.
- Content validator with field-path-precise errors, versioned promote and
  append-only rollback, and a published-content viewer.
- Shared Zod content schemas and the entitlements / auth schema.
- Static 9-max poker table, lightweight card rendering, MCQ interface with a
  feedback drawer, and a tap-to-define glossary drawer (member UI).
- PWA scaffold (manifest + service worker) and CI (lint + build on every PR).

[Unreleased]: https://github.com/tech-up-dev/poker-trainer/commits/dev
