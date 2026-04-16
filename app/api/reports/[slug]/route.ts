import { NextRequest, NextResponse } from "next/server";
import { deleteReport } from "@/lib/store";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const uploadSecret = process.env.UPLOAD_SECRET;
  if (uploadSecret) {
    const provided = request.headers.get("x-upload-secret");
    if (provided !== uploadSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { slug } = await params;
  const deleted = await deleteReport(slug);

  if (!deleted) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
