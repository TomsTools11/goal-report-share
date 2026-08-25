import { put, head, list, del } from "@vercel/blob";
import { normalizeKind, type ReportKind } from "./report-kind";

export type { ReportKind };

export interface ReportMeta {
  slug: string;
  title: string;
  filename: string;
  url: string;
  uploadedAt: string;
  // Absent on reports stored before PDF support — normalizeKind() reads those as "html".
  kind: ReportKind;
}

const PREFIX = "reports/";
const META_PREFIX = "meta/";

const EXTENSIONS: Record<ReportKind, string> = {
  html: "html",
  pdf: "pdf",
};

const CONTENT_TYPES: Record<ReportKind, string> = {
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
};

// Every kind we might have to look under when all we hold is a slug.
const ALL_KINDS: ReportKind[] = ["html", "pdf"];

function blobPath(slug: string, kind: ReportKind) {
  return `${PREFIX}${slug}.${EXTENSIONS[kind]}`;
}

function metaPath(slug: string) {
  return `${META_PREFIX}${slug}.json`;
}

export interface StoreReportInput {
  slug: string;
  kind: ReportKind;
  /** Sanitized HTML, or the PDF's bytes verbatim. */
  body: string | ArrayBuffer;
  title: string;
  filename: string;
}

export async function storeReport({
  slug,
  kind,
  body,
  title,
  filename,
}: StoreReportInput): Promise<ReportMeta> {
  const uploadedAt = new Date().toISOString();

  const blob = await put(blobPath(slug, kind), body, {
    access: "public",
    contentType: CONTENT_TYPES[kind],
    addRandomSuffix: false,
  });

  const meta: ReportMeta = {
    slug,
    title,
    filename,
    url: blob.url,
    uploadedAt,
    kind,
  };

  await put(metaPath(slug), JSON.stringify(meta), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return meta;
}

export type StoredReport =
  | { kind: "html"; html: string }
  | { kind: "pdf"; bytes: ArrayBuffer; filename: string | null };

export async function getReport(slug: string): Promise<StoredReport | null> {
  // A slug doesn't say which extension its report was stored under, so probe every kind at once:
  // one round trip's latency either way, and no dependency on the metadata blob (which older
  // reports may be missing).
  const [htmlUrl, pdfUrl] = await Promise.all([blobUrl(slug, "html"), blobUrl(slug, "pdf")]);

  if (htmlUrl) {
    const res = await fetch(htmlUrl);
    if (!res.ok) return null;
    return { kind: "html", html: await res.text() };
  }

  if (pdfUrl) {
    // The metadata carries the original filename, which the response offers back to the browser's
    // PDF viewer as the download name. Fetch it alongside the bytes; a miss is not fatal.
    const [res, meta] = await Promise.all([fetch(pdfUrl), getReportMeta(slug)]);
    if (!res.ok) return null;
    return { kind: "pdf", bytes: await res.arrayBuffer(), filename: meta?.filename ?? null };
  }

  return null;
}

export async function getReportMeta(slug: string): Promise<ReportMeta | null> {
  try {
    const blob = await head(metaPath(slug));
    const res = await fetch(blob.url);
    if (!res.ok) return null;
    return normalizeMeta(await res.json());
  } catch {
    return null;
  }
}

export async function listReports(): Promise<ReportMeta[]> {
  const { blobs } = await list({ prefix: META_PREFIX });
  const results: ReportMeta[] = [];

  for (const blob of blobs) {
    try {
      const res = await fetch(blob.url);
      const meta = normalizeMeta(await res.json());
      if (meta) results.push(meta);
    } catch {
      // skip malformed entries
    }
  }

  return results;
}

export async function deleteReport(slug: string): Promise<boolean> {
  const urls = (await Promise.all(ALL_KINDS.map((kind) => blobUrl(slug, kind)))).filter(
    (url): url is string => url !== null
  );

  if (urls.length === 0) return false;
  await Promise.all(urls.map((url) => del(url)));

  try {
    const metaBlob = await head(metaPath(slug));
    await del(metaBlob.url);
  } catch {
    // metadata may not exist, still consider delete successful
  }

  return true;
}

// Resolved blob URL for one kind, or null when nothing is stored under it.
async function blobUrl(slug: string, kind: ReportKind): Promise<string | null> {
  try {
    const blob = await head(blobPath(slug, kind));
    return blob.url;
  } catch {
    return null;
  }
}

function normalizeMeta(raw: unknown): ReportMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Partial<ReportMeta>;
  if (typeof meta.slug !== "string") return null;
  return {
    slug: meta.slug,
    title: typeof meta.title === "string" ? meta.title : "Untitled Report",
    filename: typeof meta.filename === "string" ? meta.filename : "",
    url: typeof meta.url === "string" ? meta.url : "",
    uploadedAt: typeof meta.uploadedAt === "string" ? meta.uploadedAt : "",
    kind: normalizeKind(meta.kind),
  };
}
