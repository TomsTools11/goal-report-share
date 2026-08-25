import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { storeReport } from "@/lib/store";
import { sanitizeReport, extractTitle } from "@/lib/sanitize";
import { rewriteAssets, type AssetNotice } from "@/lib/rewrite-assets";
import { looksLikePdf, extractPdfTitle } from "@/lib/pdf";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB } from "@/lib/limits";
import { ACCEPTED_LABEL, filenameStem, kindForFilename } from "@/lib/report-kind";

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
    const kind = kindForFilename(file.name);
    if (!kind) {
      results.push({ filename: file.name, error: `Unsupported file type — ${ACCEPTED_LABEL} only` });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      results.push({ filename: file.name, error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` });
      continue;
    }

    const slug = nanoid(8);

    if (kind === "pdf") {
      // Stored byte-for-byte: a PDF can't be sanitized the way markup can, and doesn't need to be
      // (see lib/pdf.ts). The extension alone isn't trusted — the signature check is what decides
      // this really is a PDF, so nothing else gets served under `application/pdf`.
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!looksLikePdf(bytes)) {
        results.push({ filename: file.name, error: "Not a valid PDF file" });
        continue;
      }

      const meta = await storeReport({
        slug,
        kind,
        body: buffer,
        // A PDF's own title beats the filename in the report list, but plenty of PDFs either
        // carry none or bury it in a compressed object stream.
        title: extractPdfTitle(bytes) ?? filenameStem(file.name),
        filename: file.name,
      });

      results.push({
        filename: file.name,
        kind,
        slug: meta.slug,
        title: meta.title,
        url: `/r/${meta.slug}`,
        notices: [] as AssetNotice[],
      });
      continue;
    }

    const rawHtml = await file.text();
    const { html: rewrittenHtml, notices }: { html: string; notices: AssetNotice[] } =
      rewriteAssets(rawHtml);
    const sanitizedHtml = sanitizeReport(rewrittenHtml);
    const title = extractTitle(rewrittenHtml);

    const meta = await storeReport({
      slug,
      kind,
      body: sanitizedHtml,
      title,
      filename: file.name,
    });

    results.push({
      filename: file.name,
      kind,
      slug: meta.slug,
      title: meta.title,
      url: `/r/${meta.slug}`,
      notices,
    });
  }

  return NextResponse.json({ reports: results });
}
