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

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline' https:; font-src data: https:; img-src data: https:; connect-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
