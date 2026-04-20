"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BrandMark } from "./brand-mark";

interface UploadResult {
  filename: string;
  slug?: string;
  title?: string;
  url?: string;
  error?: string;
}

interface Report {
  slug: string;
  title: string;
  filename: string;
  uploadedAt: string;
}

const SESSION_KEY = "reports:v1";

function readSession(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Report[]) : [];
  } catch {
    return [];
  }
}

function writeSession(reports: Report[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(reports));
  } catch {
    // quota or privacy-mode errors — non-fatal
  }
}

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReports(readSession());
  }, []);

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setResults([]);

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      const uploaded: UploadResult[] = data.reports ?? [];
      setResults(uploaded);

      const now = new Date().toISOString();
      const newEntries: Report[] = uploaded
        .filter((r): r is UploadResult & { slug: string } => Boolean(r.slug))
        .map((r) => ({
          slug: r.slug,
          title: r.title ?? r.filename,
          filename: r.filename,
          uploadedAt: now,
        }));

      if (newEntries.length > 0) {
        setReports((prev) => {
          const next = [...newEntries, ...prev];
          writeSession(next);
          return next;
        });
      }
    } catch {
      setResults([{ filename: "upload", error: "Upload failed" }]);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleDelete = async (slug: string) => {
    if (!confirm("Delete this report? The shared link will stop working.")) return;
    const res = await fetch(`/api/reports/${slug}`, { method: "DELETE" });
    if (!res.ok) return;
    setReports((prev) => {
      const next = prev.filter((r) => r.slug !== slug);
      writeSession(next);
      return next;
    });
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const filtered = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* ═════════════════════════════════════════
          Top bar — compact, brand-forward
          ═════════════════════════════════════════ */}
      <header className="sticky top-0 z-20 border-b border-[var(--surface-border)] bg-[var(--surface-0)]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[var(--brand)]">
              <BrandMark size={22} />
            </span>
            <span className="font-semibold tracking-tight text-[15px]">
              Report Share
            </span>
          </div>
          <div className="text-xs text-[var(--text-tertiary)] font-mono tabular-nums">
            {reports.length > 0 && (
              <>
                {reports.length} {reports.length === 1 ? "report" : "reports"}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 pb-24">
        {/* ═════════════════════════════════════════
            Hero / Upload — the focal point
            ═════════════════════════════════════════ */}
        <section className="pt-16 pb-10">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h1 className="text-[34px] leading-[1.15] font-semibold tracking-[-0.02em]">
              Ship a report.{" "}
              <span className="text-[var(--text-tertiary)]">Share a link.</span>
            </h1>
            <p className="mt-3 text-[15px] text-[var(--text-secondary)] leading-relaxed">
              Drop an HTML file, get a shareable URL in seconds. Your client
              sees the report exactly as designed — no account, no install.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative group cursor-pointer rounded-2xl
              overflow-hidden
              transition-[background,border,transform] duration-200
              ${
                dragging
                  ? "ring-pulse bg-[var(--brand-soft)] border-[var(--brand)]"
                  : "bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border-[var(--surface-border)]"
              }
              border border-dashed
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* subtle diagonal accent line */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.35] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, transparent 49.5%, var(--surface-border) 49.5%, var(--surface-border) 50.5%, transparent 50.5%)",
                backgroundSize: "22px 22px",
              }}
            />

            <div className="relative px-8 py-16 text-center">
              <div
                className={`
                  inline-flex items-center justify-center
                  w-16 h-16 rounded-2xl mb-5
                  transition-all duration-300
                  ${
                    uploading
                      ? "bg-[var(--brand)] text-white"
                      : dragging
                      ? "bg-[var(--brand)] text-white scale-110"
                      : "bg-[var(--surface-0)] text-[var(--brand)] border border-[var(--surface-border)] group-hover:border-[var(--brand)] brand-mark-idle"
                  }
                `}
              >
                {uploading ? (
                  <Spinner />
                ) : (
                  <BrandMark size={30} />
                )}
              </div>

              <p className="text-[17px] font-medium tracking-tight">
                {uploading
                  ? "Uploading…"
                  : dragging
                  ? "Release to upload"
                  : "Drop HTML reports here"}
              </p>
              <p className="mt-1.5 text-[13px] text-[var(--text-tertiary)]">
                or click to browse
                <span className="mx-1.5 text-[var(--surface-border-strong)]">·</span>
                .html files up to 500 KB
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-[12px] text-[var(--text-tertiary)]">
            Uploads you make here stay in this tab&apos;s report list until you close it.
            Shareable links keep working after that — the list just resets.
          </p>

          {/* ─── Upload results inline ─── */}
          {results.length > 0 && (
            <div className="mt-6 space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`
                    flex items-center justify-between rounded-xl px-4 py-3 text-sm
                    border
                    ${
                      r.error
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400"
                        : "bg-[var(--surface-1)] border-[var(--surface-border)]"
                    }
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {!r.error && (
                      <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--brand)] text-white">
                        <CheckIcon />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {r.title || r.filename}
                      </div>
                      {r.error ? (
                        <div className="text-xs mt-0.5 opacity-80">{r.error}</div>
                      ) : (
                        <div className="text-xs mt-0.5 text-[var(--text-tertiary)] font-mono truncate">
                          {typeof window !== "undefined"
                            ? `${window.location.host}${r.url}`
                            : r.url}
                        </div>
                      )}
                    </div>
                  </div>
                  {r.slug && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(r.slug!);
                      }}
                      className="ml-4 px-3.5 h-8 rounded-lg text-xs font-medium bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-colors flex-shrink-0"
                    >
                      {copiedSlug === r.slug ? "Copied" : "Copy link"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═════════════════════════════════════════
            Reports — dense, scannable table
            ═════════════════════════════════════════ */}
        {reports.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Your reports
                </h2>
                <span className="text-[13px] text-[var(--text-tertiary)] font-mono tabular-nums">
                  {filtered.length}
                  {filtered.length !== reports.length && ` / ${reports.length}`}
                </span>
              </div>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 pr-3 text-[13px] bg-[var(--surface-1)] border border-[var(--surface-border)] rounded-lg w-48 focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-[border,box-shadow]"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-14 text-center text-sm text-[var(--text-tertiary)] border border-dashed border-[var(--surface-border)] rounded-xl">
                No reports match &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--surface-border)] overflow-hidden bg-[var(--surface-0)]">
                <ul className="divide-y divide-[var(--surface-border)]">
                  {filtered.map((report) => (
                    <li
                      key={report.slug}
                      className="group grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_auto] gap-4 items-center px-5 py-3.5 hover:bg-[var(--surface-1)] transition-colors"
                    >
                      <a
                        href={`/r/${report.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0"
                      >
                        <div className="font-medium text-[14px] truncate group-hover:text-[var(--brand)] transition-colors">
                          {report.title}
                        </div>
                        <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5 font-mono truncate">
                          /r/{report.slug}
                          <span className="mx-1.5 text-[var(--surface-border-strong)]">
                            ·
                          </span>
                          {report.filename}
                        </div>
                      </a>
                      <div className="hidden sm:block text-[12px] text-[var(--text-tertiary)] tabular-nums">
                        {formatDate(report.uploadedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyLink(report.slug)}
                          title="Copy shareable link"
                          aria-label="Copy link"
                          className={`
                            inline-flex items-center justify-center
                            h-8 px-3 rounded-lg text-[12px] font-medium
                            transition-colors
                            ${
                              copiedSlug === report.slug
                                ? "bg-[var(--brand)] text-white"
                                : "text-[var(--text-secondary)] hover:text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                            }
                          `}
                        >
                          {copiedSlug === report.slug ? (
                            <>
                              <CheckIcon className="mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <LinkIcon className="mr-1" />
                              Copy
                            </>
                          )}
                        </button>
                        <a
                          href={`/r/${report.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open report"
                          aria-label="Open report"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                        >
                          <ExternalIcon />
                        </a>
                        <button
                          onClick={() => handleDelete(report.slug)}
                          title="Delete report"
                          aria-label="Delete report"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-tertiary)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/* ───────── Icons (tiny, stroke-current) ───────── */

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2.5 6.5 L5 9 L9.5 3.5" />
    </svg>
  );
}

function LinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6.5 9.5 L9.5 6.5" />
      <path d="M9 4.5 L10.5 3 A2.5 2.5 0 0 1 14 6.5 L12.5 8 M7 11.5 L5.5 13 A2.5 2.5 0 0 1 2 9.5 L3.5 8" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2.5 H13.5 V7" />
      <path d="M13.5 2.5 L7.5 8.5" />
      <path d="M12 10 V13 A0.5 0.5 0 0 1 11.5 13.5 H3 A0.5 0.5 0 0 1 2.5 13 V4.5 A0.5 0.5 0 0 1 3 4 H6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4 H13.5" />
      <path d="M6 4 V2.5 H10 V4" />
      <path d="M4 4 V13 A1 1 0 0 0 5 14 H11 A1 1 0 0 0 12 13 V4" />
      <path d="M6.5 6.5 V11.5" />
      <path d="M9.5 6.5 V11.5" />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L13.5 13.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12 A9 9 0 0 0 12 3"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ───────── Formatting helpers ───────── */

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHr = Math.round(diffMs / 3600000);
  const diffDay = Math.round(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
