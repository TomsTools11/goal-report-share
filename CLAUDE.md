# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start Next.js dev server on http://localhost:3000
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (uses flat config, `eslint-config-next`)

No test suite is configured.

## Architecture

DropDoc is a single-purpose Next.js 16 (App Router) + React 19 tool for uploading standalone HTML reports, sanitizing them, storing them in Vercel Blob, and serving them at stable shareable URLs.

### Upload → serve pipeline

1. `app/page.tsx` — client-only drag-and-drop UI. Posts files as `FormData` to `/api/upload`. Known slugs are persisted in `sessionStorage` under `reports:v1`; there is no server-side user/account model. Surfaces per-file `notices` from the upload response when references were rewritten or stripped.
2. `app/api/upload/route.ts` — validates `.htm(l)` extension and the 1.25MB per-file cap (`MAX_FILE_SIZE`), runs `rewriteAssets` to fix sibling-file references from "Save Page As"–style exports, sanitizes the body with `sanitizeReport`, extracts `<title>` for display, mints an 8-char `nanoid` slug, and stores via `storeReport`. Returns per-file `notices` describing any rewrites or removals.
3. `lib/rewrite-assets.ts` — pre-sanitization compatibility layer. Maps relative `<script src>` and `<link rel=stylesheet href>` references to known-library CDN URLs (Chart.js, D3, Leaflet, Plotly, Highcharts, ECharts, jQuery, etc.). Unrecognized relative references are stripped, with the basename surfaced to the uploader. Absolute URLs (`http(s):`, `//`, `data:`, `blob:`) pass through. This is a *compatibility* layer, not a *security* layer — the sanitizer + CSP sandbox below are still what enforce safety.
4. `lib/store.ts` — Vercel Blob wrapper. Two objects per report: `reports/<slug>.html` (sanitized body) and `meta/<slug>.json` (title, filename, timestamp, blob URL). Uses `addRandomSuffix: false` so slugs map 1:1 to blob keys.
5. `app/r/[slug]/route.ts` — GETs the stored HTML and returns it with a strict CSP (see next section). Cached public for 1h.
6. `app/api/reports/[slug]/route.ts` — DELETE endpoint; removes both the HTML and metadata blobs.

### The security boundary: sanitizer + CSP sandbox (both are required)

The sanitizer in `lib/sanitize.ts` is unusually permissive — it allows `<script>`, `<style>`, `<template>`, inline event-free HTML, and form controls — *because* `app/r/[slug]/route.ts` serves every report with a sandbox CSP that isolates it from the app. The policy is `sandbox allow-scripts allow-popups` + `default-src 'none'`, then re-opens specific resource types: `script-src`/`style-src 'unsafe-inline' https: blob:`, `img-`/`font-`/`media-src data: https: blob:`, and `connect-src https: blob:`. `frame-src 'none'`, `base-uri 'none'`, and `form-action 'none'` lock down the rest.

The `sandbox` directive (note: **no** `allow-same-origin`) forces the document into a null/opaque origin, so uploaded scripts can run (Leaflet, Chart.js, self-unpacking base64 bundles via `blob:` URLs) and can even fetch external `https:` data and map tiles — but cannot read the app's cookies, `localStorage`, or hit its same-origin endpoints. The deliberate trade-off: a report **can** talk to arbitrary external `https:` hosts (so legitimate reports load CDN libraries and live data), it just can't reach anything belonging to DropDoc itself. The absence of `allow-top-navigation` keeps it from redirecting the parent tab, and `form-action 'none'` blocks form-based exfiltration.

If you change either side, change the other deliberately:
- Loosening the CSP (adding `allow-same-origin`, relaxing `form-action`, etc.) turns uploads into XSS against the app.
- Tightening the sanitizer without also tightening CSP usually just breaks reports.

Non-obvious invariants in `sanitize.ts` — each exists to keep real reports rendering, and each is safe *only* because of the CSP sandbox above:
- `allowVulnerableTags: true` is intentional — it's required to keep `<style>` through sanitization.
- **No `allowedStyles` config** — inline `style=` attributes pass through verbatim. `sanitize-html`'s `allowedStyles` keys are literal property names, not regex, so the tempting `{ "/.*/": [/.*/] }` matches nothing and strips *every* inline style, which breaks reports that lean on per-element colors/grids/backgrounds. CSS-borne threats are handled by the null origin instead.
- `<template>` is allowed. It's inert by spec (contents parse into a `DocumentFragment` and don't execute until cloned), and client-routed reports that ship multiple views in one file depend on `getElementById('…').content`. Stripping the wrapper dumps its children into `<body>` and breaks both layout and lookups.
- `EMPTY_VALUE_SENTINEL`: `sanitize-html` drops attributes whose value is the empty string. The sentinel preserves `value=""` on `<option>` and similar, which interactive report filters rely on. Don't remove the pre/post-processing dance without a replacement.
- `transformTags.a` rewrites only *off-document* links to `target="_blank"` + `rel="noopener noreferrer"`. In-page `#anchor` links are left untouched so a report's own sidebar/section navigation stays in the same tab — don't blanket-force `_blank`.

### Auth

Upload and delete are gated by an optional `UPLOAD_SECRET` env var, checked via the `x-upload-secret` header. If the env var is unset, both endpoints are open — fine for local dev, not for production.

### Deployment assumption

Runs on Vercel. `@vercel/blob` is the only storage backend; there is no DB. Listing on the home page is purely client-side `sessionStorage` — the server's `listReports` helper exists but isn't wired into the UI.

### Theming (light/dark)

Theme is a single `data-theme="light|dark"` attribute on `<html>`; all colors are CSS variables in `app/globals.css`, with dark values keyed off `[data-theme="dark"]`. To avoid a flash of the wrong theme, `app/layout.tsx` runs a small **blocking inline `<script>`** that sets the attribute *before paint* from `localStorage['dropdoc-theme']`, falling back to `prefers-color-scheme`. `app/page.tsx` reads and toggles it at runtime. `<html suppressHydrationWarning>` is required because the server can't know the client's stored theme — keep that in mind before adding theme-dependent server-rendered markup.
