# Lighthouse PWA Baseline

Captured against the production preview served by `npm run build && npm run preview`, so the service worker and manifest are exactly what members receive.

## How to run

```bash
npm run build
npm run preview
```

Then in Chrome DevTools → Lighthouse → Categories: **Progressive Web App** (and, optionally, Performance). Run against `http://localhost:4173/`. Save the JSON report to `docs/lighthouse-runs/<yyyy-mm-dd>.json` and update the table below.

## Latest run

| Field | Value |
|----|----|
| Date | _TBD_ |
| Commit | _TBD_ |
| Route audited | `/` |
| Chrome version | _TBD_ |

### PWA installability

| Check | Status | Notes |
|----|----|----|
| Web app manifest meets install criteria | ☐ | |
| Registers a service worker that controls page and start_url | ☐ | |
| Provides a valid `apple-touch-icon` | ☐ | Placeholder SVG until brand icon lands (see [pwa-icons-todo.md](./pwa-icons-todo.md)) |
| Sets a theme color for the address bar | ☐ | `#0f172a` |
| Content is sized correctly for the viewport | ☐ | |
| Has a `<meta name="viewport">` tag with `width` or `initial-scale` | ☐ | |
| Manifest has a maskable icon | ☐ | Current SVG marked `any maskable`; verify Lighthouse accepts SVG |

### Optional-but-tracked

| Check | Status | Notes |
|----|----|----|
| Provides valid `apple-touch-icon` at 180×180 PNG | ☐ | Blocked on brand icon |
| Manifest lists at least one 192×192 and one 512×512 PNG icon | ☐ | Blocked on brand icon |
| Contains `screenshots[]` for a richer install UI | ☐ | Blocked on styled UI |

## Known gaps expected to fail until brand assets land

Documented so no one confuses "not yet done" with "regression":

- Placeholder SVG icon in manifest — will swap for real PNG set when Steve delivers the 512×512 master.
- `screenshots[]` empty — will populate during the M1 table-UI polish pass.

## Runs history

| Date | Commit | PWA score | Notes |
|----|----|----|----|
| _first run TBD_ | | | |
