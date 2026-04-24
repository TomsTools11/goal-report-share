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

1. `app/page.tsx` — client-only drag-and-drop UI. Posts files as `FormData` to `/api/upload`. Known slugs are persisted in `sessionStorage` under `reports:v1`; there is no server-side user/account model.
2. `app/api/upload/route.ts` — validates `.htm(l)` extension and the 1.25MB per-file cap (`MAX_FILE_SIZE`), sanitizes the body with `sanitizeReport`, extracts `<title>` for display, mints an 8-char `nanoid` slug, and stores via `storeReport`.
3. `lib/store.ts` — Vercel Blob wrapper. Two objects per report: `reports/<slug>.html` (sanitized body) and `meta/<slug>.json` (title, filename, timestamp, blob URL). Uses `addRandomSuffix: false` so slugs map 1:1 to blob keys.
4. `app/r/[slug]/route.ts` — GETs the stored HTML and returns it with a strict CSP (see next section). Cached public for 1h.
5. `app/api/reports/[slug]/route.ts` — DELETE endpoint; removes both the HTML and metadata blobs.

### The security boundary: sanitizer + CSP sandbox (both are required)

The sanitizer in `lib/sanitize.ts` is unusually permissive — it allows `<script>`, `<style>`, inline event-free HTML, and form controls — *because* `app/r/[slug]/route.ts` serves every report with `Content-Security-Policy: sandbox allow-scripts allow-popups` plus `default-src 'none'`. The `sandbox` directive forces the document into a null/opaque origin, so uploaded scripts can run (Leaflet, Chart.js, self-unpacking base64 bundles via `blob:` URLs) but cannot read the app's cookies, localStorage, or hit same-origin endpoints. `form-action 'none'` and the absence of `allow-top-navigation` also matter.

If you change either side, change the other deliberately:
- Loosening the CSP (adding `allow-same-origin`, relaxing `form-action`, etc.) turns uploads into XSS against the app.
- Tightening the sanitizer without also tightening CSP usually just breaks reports.

Two subtle invariants in `sanitize.ts`:
- `allowVulnerableTags: true` is intentional — it's required to keep `<style>` through sanitization.
- `sanitize-html` drops attributes whose value is the empty string. `EMPTY_VALUE_SENTINEL` preserves `value=""` on `<option>` and similar, which interactive report filters rely on. Don't remove the pre/post-processing dance without a replacement.

### Auth

Upload and delete are gated by an optional `UPLOAD_SECRET` env var, checked via the `x-upload-secret` header. If the env var is unset, both endpoints are open — fine for local dev, not for production.

### Deployment assumption

Runs on Vercel. `@vercel/blob` is the only storage backend; there is no DB. Listing on the home page is purely client-side `sessionStorage` — the server's `listReports` helper exists but isn't wired into the UI.
