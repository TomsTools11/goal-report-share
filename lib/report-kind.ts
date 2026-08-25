// What DropDoc accepts, in one place. Imported by both the browser dropzone (app/page.tsx) and
// the upload handler (app/api/upload/route.ts) so the client-side pre-check and the server-side
// guard can never drift on which extensions are allowed.
//
// Keep this module free of server-only imports (@vercel/blob, node builtins) — it ships to the
// client as part of the landing page bundle.

export type ReportKind = "html" | "pdf";

// `accept` attribute for the file picker.
export const ACCEPTED_EXTENSIONS = ".html,.htm,.pdf";

// Human-facing phrasing, used in copy and in upload error messages.
export const ACCEPTED_LABEL = ".html and .pdf";

const EXTENSION_KINDS: ReadonlyArray<readonly [RegExp, ReportKind]> = [
  [/\.html?$/i, "html"],
  [/\.pdf$/i, "pdf"],
];

// Which pipeline a file goes through, decided by extension alone. `null` means "we don't take
// this". The extension is a routing hint, not a trust signal: the PDF branch re-checks the magic
// bytes (lib/pdf.ts) and the HTML branch sanitizes whatever it's given.
export function kindForFilename(filename: string): ReportKind | null {
  for (const [pattern, kind] of EXTENSION_KINDS) {
    if (pattern.test(filename)) return kind;
  }
  return null;
}

export function kindLabel(kind: ReportKind): string {
  return kind === "pdf" ? "PDF" : "HTML";
}

// Tolerates stored/legacy values: reports uploaded before PDF support have no `kind` recorded,
// and they are all HTML.
export function normalizeKind(value: unknown): ReportKind {
  return value === "pdf" ? "pdf" : "html";
}

// Filename minus its extension — the title fallback when a document carries no title of its own.
export function filenameStem(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, "") || filename;
}
