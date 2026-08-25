import { NextRequest, NextResponse } from "next/server";
import { getReport, type StoredReport } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const report = await getReport(slug);

  if (!report) {
    return new NextResponse("Report not found", { status: 404 });
  }

  return report.kind === "pdf" ? pdfResponse(report) : htmlResponse(report.html);
}

function htmlResponse(html: string) {
  // `sandbox allow-scripts allow-popups` forces the document into an opaque/null origin so
  // uploaded scripts can run (Leaflet, inline data, etc.) but cannot touch this app's cookies,
  // localStorage, or same-origin endpoints. Without `allow-same-origin` the document's origin is
  // null; without `allow-top-navigation` it can't redirect the tab. External https script/style/
  // image/font/XHR loads are permitted so CDN-hosted libraries and map tiles work. `blob:` is
  // allowed so self-unpacking report bundles (base64 assets → `URL.createObjectURL`) can inject
  // their scripts, styles, images, and fonts.
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": [
        "sandbox allow-scripts allow-popups",
        "default-src 'none'",
        "script-src 'unsafe-inline' https: blob:",
        "style-src 'unsafe-inline' https: blob:",
        "img-src data: https: blob:",
        "font-src data: https: blob:",
        "media-src data: https: blob:",
        "connect-src https: blob:",
        "frame-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function pdfResponse(report: Extract<StoredReport, { kind: "pdf" }>) {
  // PDFs deliberately do *not* get the sandbox CSP the HTML branch relies on.
  //
  // That sandbox exists to strip an uploaded document of this origin's privileges, because an
  // uploaded <script> would otherwise run as DropDoc. A PDF has no comparable reach: it has no
  // DOM and executes no page script — browsers hand it to their own out-of-process viewer — so it
  // cannot read this app's cookies, storage, or same-origin endpoints whether it is sandboxed or
  // not. Set against that nil benefit is a real rendering risk: the built-in viewers are
  // themselves documents, and browsers differ on how they treat a sandboxed one. Chromium renders
  // it fine today; a browser that instead falls back to "download this file" would break the one
  // thing a shared link has to do.
  //
  // What actually carries the weight here is pairing an explicit `application/pdf` with
  // `nosniff`: together they stop a polyglot upload — bytes that are a valid PDF *and* valid
  // HTML — from ever being re-interpreted as markup on this origin. The directives below are
  // inert for a real PDF and cost nothing if some future browser does treat one as a document.
  return new NextResponse(report.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(report.filename),
      "Content-Security-Policy": [
        "default-src 'none'",
        // 'self' rather than 'none': plugin-style PDF viewing is object-src-governed in some
        // browsers, and there is nothing to gain by blocking the viewer from loading the very
        // document it was handed.
        "object-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// `inline` so the browser shows the report rather than downloading it; the filename is what the
// viewer's own Save button offers. RFC 6266 asks for both forms — a plain-ASCII fallback and the
// UTF-8 one — since the original filename is arbitrary user input.
function contentDisposition(filename: string | null): string {
  const fallback = "report.pdf";
  const base = (filename ?? fallback).split(/[\\/]/).pop() || fallback;
  const ascii = base.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(base)}`;
}
