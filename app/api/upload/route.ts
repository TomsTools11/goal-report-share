import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { storeReport } from "@/lib/store";
import { sanitizeReport, extractTitle } from "@/lib/sanitize";
import { rewriteAssets, type AssetNotice } from "@/lib/rewrite-assets";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB } from "@/lib/limits";

export async function POST(request: NextRequest) {
  // Optional upload protection
  const uploadSecret = process.env.UPLOAD_SECRET;
  if (uploadSecret) {
    const provided = request.headers.get("x-upload-secret");
    if (provided !== uploadSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    if (!file.name.match(/\.html?$/i)) {
      results.push({ filename: file.name, error: "Not an HTML file" });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      results.push({ filename: file.name, error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` });
      continue;
    }

    const rawHtml = await file.text();
    const { html: rewrittenHtml, notices }: { html: string; notices: AssetNotice[] } =
      rewriteAssets(rawHtml);
    const sanitizedHtml = sanitizeReport(rewrittenHtml);
    const title = extractTitle(rewrittenHtml);
    const slug = nanoid(8);

    const meta = await storeReport(slug, sanitizedHtml, title, file.name);

    results.push({
      filename: file.name,
      slug: meta.slug,
      title: meta.title,
      url: `/r/${meta.slug}`,
      notices,
    });
  }

  return NextResponse.json({ reports: results });
}
