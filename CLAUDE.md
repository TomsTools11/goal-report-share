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

DropDoc is a single-purpose Next.js 16 (App Router) + React 19 tool for uploading standalone HTML reports and PDFs, storing them in Vercel Blob, and serving them at stable shareable URLs. HTML is sanitized on the way in; PDFs are verified and stored verbatim. The two formats share the slug, the store, and the UI, and diverge only in how they're validated and what headers they're served with — `lib/report-kind.ts` holds the `ReportKind` union (`"html" | "pdf"`) and the extension mapping both sides use.

### Upload → serve pipeline

1. `app/page.tsx` — client-only drag-and-drop UI. Posts **one `FormData` request per file** to `/api/upload` (so each request body stays under Vercel's 4.5MB function limit no matter how many files are dropped) and pre-checks extension + size client-side before sending, then aggregates errors/notices/new-entries across the responses. Known slugs are persisted in `sessionStorage` under `reports:v1`; there is no server-side user/account model. Entries written before PDF support carry no `kind` and are normalized to `"html"` on read, so don't bump the session key for that. Surfaces per-file `notices` from the upload response when references were rewritten or stripped.
2. `app/api/upload/route.ts` — resolves the file's kind by extension (`kindForFilename`), enforces the 3.5MB per-file cap (`MAX_FILE_SIZE` in `lib/limits.ts`), then branches:
   - **HTML** — runs `rewriteAssets` to fix sibling-file references from "Save Page As"–style exports, sanitizes the body with `sanitizeReport`, extracts `<title>` for display. Returns per-file `notices` describing any rewrites or removals.
   - **PDF** — checks the file really is a PDF (`looksLikePdf`, magic bytes) and rejects it otherwise, then reads a display title with `extractPdfTitle`, falling back to the filename. Bytes are stored untouched; `notices` is always empty.

   Both branches mint an 8-char `nanoid` slug, store via `storeReport`, and return `kind` alongside the slug so the client can label the entry.
3. `lib/rewrite-assets.ts` — pre-sanitization compatibility layer for HTML only. Maps relative `<script src>` and `<link rel=stylesheet href>` references to known-library CDN URLs (Chart.js, D3, Leaflet, Plotly, Highcharts, ECharts, jQuery, etc.). Unrecognized relative references are stripped, with the basename surfaced to the uploader. Absolute URLs (`http(s):`, `//`, `data:`, `blob:`) pass through. This is a *compatibility* layer, not a *security* layer — the sanitizer + CSP sandbox below are still what enforce safety.
4. `lib/pdf.ts` — the PDF counterpart to `sanitize.ts`, minus the sanitizing: a signature check plus a best-effort title read from the Info dictionary (literal, hex, UTF-16, and PDFDocEncoding strings) falling back to the XMP packet. Titles inside compressed object streams aren't recovered — nothing is inflated — and anything that doesn't decode to plausible text is rejected so the filename wins instead.
5. `lib/store.ts` — Vercel Blob wrapper. Two objects per report: `reports/<slug>.<html|pdf>` (sanitized body, or the PDF verbatim) and `meta/<slug>.json` (title, filename, timestamp, blob URL, `kind`). Uses `addRandomSuffix: false` so slugs map 1:1 to blob keys. A slug alone doesn't reveal its extension, so reads and deletes probe both paths **in parallel** — one round trip either way, and no dependency on the metadata blob, which older reports may be missing. Metadata without a `kind` field predates PDF support and is read as HTML (`normalizeKind`).
6. `app/r/[slug]/route.ts` — serves the stored report. HTML gets the sandbox CSP (see next section); PDF gets `application/pdf` + `nosniff` + `Content-Disposition: inline` and deliberately **no** sandbox — see the comment in `pdfResponse` before changing those headers. Both cached public for 1h.
7. `app/api/reports/[slug]/route.ts` — DELETE endpoint; removes the content blob (whichever extension it's under) and the metadata blob.

### The security boundary, part 1: HTML — sanitizer + CSP sandbox (both are required)

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

### The security boundary, part 2: PDF — content type + nosniff

PDFs get a different — and deliberately looser — treatment, because the threat is different. The HTML sandbox exists to strip an uploaded document of this origin's privileges, since an uploaded `<script>` would otherwise run as DropDoc. A PDF has no comparable reach: no DOM, no page script, rendered by the browser's own out-of-process viewer. So a PDF response is served with `application/pdf`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, and a short CSP (`default-src 'none'; object-src 'self'; base-uri 'none'; form-action 'none'`) — **no `sandbox`**.

That pairing of an explicit content type with `nosniff` is what actually does the work: it stops a polyglot upload (bytes that are a valid PDF *and* valid HTML) from ever being reinterpreted as markup on this origin. `looksLikePdf` in `lib/pdf.ts` is the other half — the `.pdf` extension is only a routing hint, and the magic-byte check is what keeps non-PDF content from being served under `application/pdf` at all.

Two things worth knowing before you touch this:
- `sandbox` was left off on purpose. It protects nothing here, and browsers differ in how they treat a sandboxed PDF document — one that falls back to "download this file" breaks the only thing a shared link has to do. (Chromium renders it either way; that isn't a guarantee for the rest.)
- `object-src` is `'self'`, not `'none'`: plugin-style PDF viewing is object-src-governed in some browsers, and blocking it buys nothing.

### Auth

Upload and delete are gated by an optional `UPLOAD_SECRET` env var, checked via the `x-upload-secret` header. If the env var is unset, both endpoints are open — fine for local dev, not for production.

### Deployment assumption

Runs on Vercel. `@vercel/blob` is the only storage backend; there is no DB. Listing on the home page is purely client-side `sessionStorage` — the server's `listReports` helper exists but isn't wired into the UI.

The 3.5MB per-file cap is a consequence of the upload path, not a product decision: the whole file rides in the `/api/upload` request body, and Vercel rejects bodies over 4.5MB before the handler runs. That bites PDFs hardest, since scanned or image-heavy ones routinely exceed it. Raising the ceiling means moving to client-direct blob uploads (`@vercel/blob/client`'s `handleUpload` + a token endpoint), which changes both the upload flow and its auth surface — not a number you can just edit in `lib/limits.ts`.

### Theming (light/dark)

Theme is a single `data-theme="light|dark"` attribute on `<html>`; all colors are CSS variables in `app/globals.css`, with dark values keyed off `[data-theme="dark"]`. To avoid a flash of the wrong theme, `app/layout.tsx` runs a small **blocking inline `<script>`** that sets the attribute *before paint* from `localStorage['dropdoc-theme']`, falling back to `prefers-color-scheme`. `app/page.tsx` reads and toggles it at runtime. `<html suppressHydrationWarning>` is required because the server can't know the client's stored theme — keep that in mind before adding theme-dependent server-rendered markup.
