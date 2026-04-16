import { put, head, list, del } from "@vercel/blob";

export interface ReportMeta {
  slug: string;
  title: string;
  filename: string;
  url: string;
  uploadedAt: string;
}

const PREFIX = "reports/";
const META_PREFIX = "meta/";

function blobPath(slug: string) {
  return `${PREFIX}${slug}.html`;
}

function metaPath(slug: string) {
  return `${META_PREFIX}${slug}.json`;
}

export async function storeReport(
  slug: string,
  html: string,
  title: string,
  filename: string
): Promise<ReportMeta> {
  const uploadedAt = new Date().toISOString();

  const blob = await put(blobPath(slug), html, {
    access: "public",
    contentType: "text/html; charset=utf-8",
    addRandomSuffix: false,
  });

  const meta: ReportMeta = {
    slug,
    title,
    filename,
    url: blob.url,
    uploadedAt,
  };

  await put(metaPath(slug), JSON.stringify(meta), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return meta;
}

export async function getReport(slug: string): Promise<string | null> {
  try {
    const blob = await head(blobPath(slug));
    const res = await fetch(blob.url);
    return res.text();
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
      const meta: ReportMeta = await res.json();
      results.push(meta);
    } catch {
      // skip malformed entries
    }
  }

  return results;
}

export async function deleteReport(slug: string): Promise<boolean> {
  try {
    const htmlBlob = await head(blobPath(slug));
    await del(htmlBlob.url);
  } catch {
    return false;
  }

  try {
    const metaBlob = await head(metaPath(slug));
    await del(metaBlob.url);
  } catch {
    // metadata may not exist, still consider delete successful
  }

  return true;
}
