import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const html = await getReport(slug);

  if (!html) {
    return new NextResponse("Report not found", { status: 404 });
  }

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
