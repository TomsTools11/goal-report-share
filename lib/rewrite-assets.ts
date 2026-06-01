// Rewrites uploaded HTML so reports referencing local sibling assets (typical of "Save Page As"
// exports and similar single-file bundles) still work after upload. Two transforms run before
// sanitization:
//
//   1. <script src="./...js">  → swap to a CDN URL when the basename matches a known library
//                                (Chart.js, D3, Leaflet, Plotly, Highcharts, ECharts, jQuery, etc.)
//   2. <link rel=stylesheet href="./...css"> → same treatment for known library stylesheets
//
//   3. <img src="./assets/logo.png">     → embed inline as base64 when the basename matches a
//                                           known brand asset (the GOAL/S3 Labs logos the report
//                                           templates reference). See lib/brand-assets.ts.
//
// References we can't recognize get stripped (script) or stripped (stylesheet) and surfaced to the
// uploader as notices so they know the report needed fixing. Absolute URLs (http(s):, //, data:,
// blob:) are left alone — they either work over the wire or are already safe.
//
// For <img src>: DropDoc only ever receives the single uploaded HTML file, never the sibling
// assets folder, so a relative image reference 404s once the report is served from /r/<slug>.
// Known brand logos are embedded inline as base64 so they always render; any *other* relative
// image can't be recovered (the bytes were never uploaded) — we leave it in place but surface an
// "unresolved-image" notice so the broken image is a visible warning, not a silent surprise.
// <link rel=icon> is still left untouched (a missing favicon is graceful).
//
// Sanitization runs after this step, so any hostile attribute we might inadvertently emit gets
// scrubbed by sanitize-html. The CDN URLs all use https: and the embedded logos use data:, both of
// which the report's CSP (`img-src data: https: blob:`) already permits.

import { BRAND_ASSET_DATA_URIS } from "./brand-assets";

export type AssetNotice =
  | { kind: "rewritten"; library: string; from: string }
  | { kind: "removed-script"; from: string }
  | { kind: "removed-stylesheet"; from: string }
  | { kind: "embedded-image"; asset: string; from: string }
  | { kind: "unresolved-image"; from: string };

type LibraryRule = {
  // Matches the basename (filename only, no directory, no query/hash).
  pattern: RegExp;
  cdn: string;
  name: string;
};

// Pinned versions chosen for: stability, popularity, and matching what most "Save Page As"
// reports were originally built against. jsdelivr is preferred for its uptime + global edge.
const LIBRARY_RULES: LibraryRule[] = [
  // Chart.js (v4 UMD bundle is the modern shipping target; older filenames still alias here)
  { pattern: /^chart\.umd(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js", name: "Chart.js" },
  { pattern: /^chart(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js", name: "Chart.js" },

  // D3
  { pattern: /^d3\.v7(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js", name: "D3.js v7" },
  { pattern: /^d3\.v6(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/d3@6/dist/d3.min.js", name: "D3.js v6" },
  { pattern: /^d3\.v5(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/d3@5/dist/d3.min.js", name: "D3.js v5" },
  { pattern: /^d3(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js", name: "D3.js" },

  // Leaflet (JS + CSS)
  { pattern: /^leaflet(-src)?(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js", name: "Leaflet" },
  { pattern: /^leaflet\.css$/i, cdn: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css", name: "Leaflet CSS" },

  // Plotly
  { pattern: /^plotly(-latest)?(\.min)?\.js$/i, cdn: "https://cdn.plot.ly/plotly-latest.min.js", name: "Plotly" },
  { pattern: /^plotly-\d+(\.\d+)*(\.min)?\.js$/i, cdn: "https://cdn.plot.ly/plotly-latest.min.js", name: "Plotly" },

  // Highcharts family
  { pattern: /^highcharts(\.min)?\.js$/i, cdn: "https://code.highcharts.com/highcharts.js", name: "Highcharts" },
  { pattern: /^highstock(\.min)?\.js$/i, cdn: "https://code.highcharts.com/stock/highstock.js", name: "Highstock" },
  { pattern: /^highmaps(\.min)?\.js$/i, cdn: "https://code.highcharts.com/maps/highmaps.js", name: "Highmaps" },

  // ECharts
  { pattern: /^echarts(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js", name: "ECharts" },

  // ApexCharts
  { pattern: /^apexcharts(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/apexcharts@3.45.0/dist/apexcharts.min.js", name: "ApexCharts" },

  // Three.js
  { pattern: /^three(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js", name: "Three.js" },

  // Mermaid
  { pattern: /^mermaid(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js", name: "Mermaid" },

  // jQuery (any 1.x/2.x/3.x version, slim or full)
  { pattern: /^jquery(-\d+(\.\d+)*)?(\.slim)?(\.min)?\.js$/i, cdn: "https://code.jquery.com/jquery-3.7.1.min.js", name: "jQuery" },

  // Lodash
  { pattern: /^lodash(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js", name: "Lodash" },

  // Date libraries
  { pattern: /^moment(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/moment@2.30.1/moment.min.js", name: "Moment.js" },
  { pattern: /^dayjs(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js", name: "Day.js" },

  // Bootstrap (JS + CSS)
  { pattern: /^bootstrap\.bundle(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js", name: "Bootstrap Bundle" },
  { pattern: /^bootstrap(\.min)?\.js$/i, cdn: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js", name: "Bootstrap" },
  { pattern: /^bootstrap(\.min)?\.css$/i, cdn: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css", name: "Bootstrap CSS" },

  // Tailwind Play CDN (rare but appears in shared mockups)
  { pattern: /^tailwindcss(\.min)?\.js$/i, cdn: "https://cdn.tailwindcss.com", name: "Tailwind Play CDN" },
];

function isAbsoluteOrSafeScheme(url: string): boolean {
  return /^(https?:\/\/|\/\/|data:|blob:|mailto:)/i.test(url);
}

function basename(url: string): string {
  const noQuery = url.split("?")[0].split("#")[0];
  const segments = noQuery.split("/");
  return segments[segments.length - 1] || "";
}

function findLibraryCdn(url: string): LibraryRule | null {
  const file = basename(url);
  if (!file) return null;
  for (const rule of LIBRARY_RULES) {
    if (rule.pattern.test(file)) return rule;
  }
  return null;
}

// Replaces just the value of an attribute inside an attribute string. Doing it inside the captured
// attribute substring (not the whole tag) keeps other attributes intact.
function replaceAttrValue(attrs: string, attrName: string, newValue: string): string {
  const re = new RegExp(`(\\b${attrName}\\s*=\\s*)(["'])([^"']*)\\2`, "i");
  return attrs.replace(re, `$1$2${newValue}$2`);
}

export interface RewriteResult {
  html: string;
  notices: AssetNotice[];
}

export function rewriteAssets(html: string): RewriteResult {
  const notices: AssetNotice[] = [];

  // <script src="..."></script> — the explicit-close form is the only valid one for src-bearing
  // scripts, so we don't have to worry about self-closing variants here.
  let result = html.replace(
    /<script\b([^>]*?\bsrc\s*=\s*(["'])([^"']*)\2[^>]*?)>\s*<\/script>/gi,
    (match, attrs: string, _q: string, url: string) => {
      if (isAbsoluteOrSafeScheme(url)) return match;
      const rule = findLibraryCdn(url);
      if (rule) {
        notices.push({ kind: "rewritten", library: rule.name, from: url });
        return `<script${replaceAttrValue(attrs, "src", rule.cdn)}></script>`;
      }
      notices.push({ kind: "removed-script", from: url });
      return "";
    }
  );

  // <link ...> — both `<link ...>` and `<link ... />` forms. Only stylesheets get touched; icons,
  // preloads, manifests etc. pass through (a missing favicon is graceful; a missing stylesheet is
  // visible).
  result = result.replace(
    /<link\b([^>]*?)\s*\/?>/gi,
    (match, attrs: string) => {
      const relMatch = attrs.match(/\brel\s*=\s*(["'])([^"']*)\1/i);
      const rel = relMatch ? relMatch[2].toLowerCase() : "";
      if (!rel.split(/\s+/).includes("stylesheet")) return match;

      const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([^"']*)\1/i);
      if (!hrefMatch) return match;
      const url = hrefMatch[2];
      if (isAbsoluteOrSafeScheme(url)) return match;

      const rule = findLibraryCdn(url);
      if (rule) {
        notices.push({ kind: "rewritten", library: rule.name, from: url });
        return `<link${replaceAttrValue(attrs, "href", rule.cdn)}>`;
      }
      notices.push({ kind: "removed-stylesheet", from: url });
      return "";
    }
  );

  // <img src="..."> — void element, both `<img ...>` and `<img ... />` forms. Relative references
  // to a known brand logo are embedded inline as base64 (the assets folder is never uploaded, so
  // the file can't be fetched once served). Other relative images can't be recovered, so we leave
  // them in place but flag them — turning a silent broken image into a visible notice.
  result = result.replace(
    /<img\b([^>]*?)\s*\/?>/gi,
    (match, attrs: string) => {
      const srcMatch = attrs.match(/\bsrc\s*=\s*(["'])([^"']*)\1/i);
      if (!srcMatch) return match;
      const url = srcMatch[2];
      if (isAbsoluteOrSafeScheme(url)) return match;

      const dataUri = BRAND_ASSET_DATA_URIS[basename(url).toLowerCase()];
      if (dataUri) {
        notices.push({ kind: "embedded-image", asset: basename(url), from: url });
        return `<img${replaceAttrValue(attrs, "src", dataUri)}>`;
      }
      notices.push({ kind: "unresolved-image", from: url });
      return match;
    }
  );

  return { html: result, notices };
}
