import { NextResponse } from "next/server";
import { listReports } from "@/lib/store";

export async function GET() {
  const reports = await listReports();
  // Sort newest first
  reports.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return NextResponse.json({ reports });
}
