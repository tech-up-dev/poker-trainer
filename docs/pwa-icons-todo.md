# PWA Icons — TODO(M1): swap in brand icons

The manifest at `public/manifest.webmanifest` currently ships a single SVG icon
(`/favicon.svg`) declared as `any maskable`. This is deliberate: Steve is
supplying the app icon per the brand-asset responsibility split in
[PROJECT_BRIEF.md §9.1](./PROJECT_BRIEF.md#91-client-supplied-bushwood), and
shipping placeholder rasters now would put those placeholders into every
progress screenshot.

## When Steve delivers the icon master

Ideal delivery: a **512 × 512 PNG or SVG** with transparent background and no
edge bleed (safe zone: keep meaningful content inside the central 80% so
Android's maskable crop doesn't clip it).

## Swap steps

1. Drop the master into `public/icons/master.svg` (or `.png`).
2. Generate the raster set:
   - `icon-192.png` — Android home screen
   - `icon-512.png` — Android splash + maskable
   - `apple-touch-icon-180.png` — iOS Add-to-Home-Screen
   - `favicon-32.png` and `favicon-16.png` — browser tab
3. Update `public/manifest.webmanifest` to list the two Android icons, each
   with an explicit `sizes` and `type`; the 512 keeps `purpose: "maskable"`.
4. Update `index.html`:
   - Point `apple-touch-icon` at `/icons/apple-touch-icon-180.png`.
   - Keep the SVG favicon reference; browsers prefer it when they can.
5. Bump `CACHE_VERSION` in `public/sw.js` so cached shells re-precache the new
   icon set.

## Generation tooling

To be decided when the master arrives. Options:

- **Local, one-command**: install `sharp` as a dev-dep and add
  `npm run generate-icons` that reads the master and emits the whole set. Best
  for reproducibility.
- **Online, one-off**: use a PWA-asset generator (RealFaviconGenerator or
  similar), then commit the outputs directly.

Either is fine; the local script pays off if the brand icon revs later in the
project.

## Deferred related items

- **Screenshots** for the manifest `screenshots[]` field (richer install UI on
  Chromium) also blocked until real UI is styled. Slot into the same commit.
- **iOS splash screens** (`apple-touch-startup-image` per device) — nice-to-have
  polish, planned for M4.
