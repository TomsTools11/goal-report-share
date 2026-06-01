"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { BrandMark } from "./brand-mark";

type AssetNotice =
  | { kind: "rewritten"; library: string; from: string }
  | { kind: "removed-script"; from: string }
  | { kind: "removed-stylesheet"; from: string };

interface UploadResult {
  filename: string;
  slug?: string;
  title?: string;
  url?: string;
  error?: string;
  notices?: AssetNotice[];
}

interface UploadNotice {
  filename: string;
  notices: AssetNotice[];
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
    /* quota or privacy-mode errors — non-fatal */
  }
}

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotices, setUploadNotices] = useState<UploadNotice[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeMounted, setThemeMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReports(readSession());
    const current = (document.documentElement.getAttribute("data-theme") ===
    "dark"
      ? "dark"
      : "light") as "light" | "dark";
    setTheme(current);
    setThemeMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("dropdoc-theme", next);
    } catch {
      /* private mode / quota — non-fatal */
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setUploadError(null);
    setUploadNotices([]);

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      const uploaded: UploadResult[] = data.reports ?? [];

      const firstError = uploaded.find((r) => r.error);
      if (firstError?.error) {
        setUploadError(firstError.error);
      }

      const noticesByFile: UploadNotice[] = uploaded
        .filter((r) => r.slug && r.notices && r.notices.length > 0)
        .map((r) => ({ filename: r.filename, notices: r.notices ?? [] }));
      if (noticesByFile.length > 0) {
        setUploadNotices(noticesByFile);
      }

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
      setUploadError("Upload failed");
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
    setTimeout(() => setCopiedSlug(null), 1600);
  };

  const filtered = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="v1-root flex-1">
      {/* Header */}
      <header className="v1-header">
        <div className="v1-header-inner">
          <span className="v1-brand-swap">
            <Image
              src="/dropdoc-lockup-light.png"
              alt="DropDoc"
              width={540}
              height={225}
              className="v1-brand-light"
              priority
            />
            <Image
              src="/dropdoc-lockup.png"
              alt="DropDoc"
              width={540}
              height={225}
              className="v1-brand-dark"
              priority
            />
          </span>
          <nav className="v1-nav">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <span className="v1-count">v1.0 · by s3 labs</span>
            <button
              type="button"
              className="v1-theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              suppressHydrationWarning
            >
              {themeMounted ? (
                theme === "dark" ? (
                  <Ic.sun />
                ) : (
                  <Ic.moon />
                )
              ) : (
                <span style={{ width: 16, height: 16, display: "block" }} />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="v1-hero">
        <p className="v1-kicker">
          A tiny utility from <span>S3 Labs</span>
        </p>
        <h1 className="v1-h1">
          <span className="brand">Ship a report.</span>
          <br />
          <span className="muted">Share a link.</span>
        </h1>
        <p className="v1-lead">
          Drop an HTML file, get a shareable URL in seconds. Your client sees the
          report exactly as designed — no account, no install.
        </p>
      </section>

      {/* Stage — dropzone alone when empty, dropzone + reports side-by-side when populated */}
      <div
        className={`v1-stage${
          reports.length > 0 ? " v1-stage--with-reports" : ""
        }`}
      >
      {/* Dropzone */}
      <section className="v1-dz-wrap">
        <div
          className={`v1-dz${dragging ? " dragging" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="v1-dz-hatch" aria-hidden />
          <div className="v1-dz-body">
            <div
              className={`v1-dz-chip${
                uploading ? " uploading" : dragging ? " dragging" : " idle"
              }`}
            >
              {uploading ? <Spinner /> : <BrandMark size={30} />}
            </div>
            <p className="v1-dz-lead">
              {uploading
                ? "Uploading…"
                : dragging
                ? "Release to upload"
                : "Drop HTML reports here"}
            </p>
            <p className="v1-dz-hint">
              or click to browse
              <span className="dot">·</span>.html files up to 1.25&nbsp;MB
            </p>
          </div>
        </div>
        {uploadError ? (
          <p className="v1-dz-error">{uploadError}</p>
        ) : (
          <p className="v1-dz-tail">
            Uploads you make here stay in this tab&apos;s report list until you
            close it. Shareable links keep working after that — the list just
            resets.
          </p>
        )}
        {uploadNotices.length > 0 && (
          <div className="v1-notices" role="status">
            <div className="v1-notices-head">
              <span>We patched some references so your report renders correctly.</span>
              <button
                type="button"
                className="v1-notices-dismiss"
                onClick={() => setUploadNotices([])}
                aria-label="Dismiss notices"
              >
                ×
              </button>
            </div>
            {uploadNotices.map((file, fi) => (
              <div key={fi} className="v1-notices-file">
                <div className="v1-notices-filename">{file.filename}</div>
                <ul className="v1-notices-list">
                  {file.notices.map((n, i) => (
                    <li key={i} className={`v1-notice v1-notice--${n.kind}`}>
                      {n.kind === "rewritten" ? (
                        <>
                          <strong>Loaded {n.library} from CDN</strong>
                          <span className="v1-notice-from">
                            was: <code>{n.from}</code>
                          </span>
                        </>
                      ) : n.kind === "removed-script" ? (
                        <>
                          <strong>Removed unresolvable script</strong>
                          <span className="v1-notice-from">
                            <code>{n.from}</code>
                          </span>
                        </>
                      ) : (
                        <>
                          <strong>Removed unresolvable stylesheet</strong>
                          <span className="v1-notice-from">
                            <code>{n.from}</code>
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reports preview — only shown when the tab has reports */}
      {reports.length > 0 && (
        <section className="v1-section v1-section--tight v1-stage-reports">
          <header className="v1-section-head--row">
            <span className="v1-section-eyebrow">— Your reports</span>
            <div className="v1-search">
              <Ic.search />
              <input
                placeholder="Search reports"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </header>

          {filtered.length === 0 ? (
            <div
              style={{
                padding: "56px 24px",
                textAlign: "center",
                fontSize: 14,
                color: "var(--text-tertiary)",
                border: "1px dashed var(--surface-border)",
                borderRadius: 14,
              }}
            >
              No reports match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="v1-reports">
              {filtered.map((r) => (
                <div key={r.slug} className="v1-report-row">
                  <div className="v1-report-top">
                    <div className="v1-report-dot">
                      <Ic.check />
                    </div>
                    <div className="v1-report-title">{r.title}</div>
                  </div>
                  <div className="v1-report-bottom">
                    <div className="v1-report-meta">
                      <span>/r/{r.slug}</span>
                      <span className="dot">·</span>
                      <span>{r.filename}</span>
                    </div>
                    <div className="v1-report-when">
                      {formatDate(r.uploadedAt)}
                    </div>
                    <div className="v1-report-actions">
                    <button
                      className={`v1-btn-ghost ${
                        copiedSlug === r.slug ? "copied" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(r.slug);
                      }}
                    >
                      {copiedSlug === r.slug ? (
                        <>
                          <Ic.check /> Copied
                        </>
                      ) : (
                        <>
                          <Ic.link /> Copy link
                        </>
                      )}
                    </button>
                    <a
                      href={`/r/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="v1-btn-icon"
                      aria-label="Open report"
                    >
                      <Ic.external />
                    </a>
                    <button
                      className="v1-btn-icon v1-btn-del"
                      onClick={() => handleDelete(r.slug)}
                      aria-label="Delete report"
                    >
                      <Ic.trash />
                    </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      </div>

      {/* Trust meta strip */}
      <section className="v1-strip">
        <div className="v1-strip-cell">
          <span className="num">&lt; 5s</span>
          <span className="label">Live from drop</span>
        </div>
        <div className="v1-strip-cell">
          <span className="num">0</span>
          <span className="label">Accounts to create</span>
        </div>
        <div className="v1-strip-cell">
          <span className="num">∞</span>
          <span className="label">Link lifetime</span>
        </div>
        <div className="v1-strip-cell">
          <span className="num">
            1.25<small>mb</small>
          </span>
          <span className="label">Per-file ceiling</span>
        </div>
      </section>

      {/* Features */}
      <section className="v1-section" id="features">
        <header className="v1-section-head">
          <span className="v1-section-eyebrow">— Features</span>
          <h2 className="v1-section-title">
            Built for the handoff, not the homepage.
          </h2>
          <p className="v1-section-lead">
            Every feature earns its place. Nothing you&apos;d pay for and nothing
            you&apos;d miss.
          </p>
        </header>

        <div className="v1-feat-grid">
          <article className="v1-feat">
            <div className="v1-feat-icon">
              <Ic.bolt />
            </div>
            <h3>Live in five seconds</h3>
            <p>
              Drop the file. We sanitize, slug it, and stand up a stable URL
              before you reach your clipboard.
            </p>
            <code>POST /api/upload → 200</code>
          </article>

          <article className="v1-feat">
            <div className="v1-feat-icon">
              <Ic.wand />
            </div>
            <h3>Broken refs, auto-patched</h3>
            <p>
              &ldquo;Save Page As&rdquo; exports lose their chart and map
              libraries. We repoint the ones we know — Chart.js, D3, Leaflet,
              Plotly — to a CDN so the report still renders.
            </p>
            <code>./chart.js → CDN</code>
          </article>

          <article className="v1-feat">
            <div className="v1-feat-icon">
              <Ic.infinity />
            </div>
            <h3>Links don&apos;t expire</h3>
            <p>
              No free-trial countdown, no takedown clock. Once it&apos;s up, it
              stays up — even after you close the tab.
            </p>
            <code>TTL: forever</code>
          </article>

          <article className="v1-feat">
            <div className="v1-feat-icon">
              <Ic.shield />
            </div>
            <h3>Sealed in a sandbox</h3>
            <p>
              Your scripts and styles run — but inside a locked-down sandbox
              that can&apos;t read DropDoc&apos;s cookies, storage, or other
              reports. Your layout, fonts, and styling come through untouched.
            </p>
            <code>CSP: sandbox</code>
          </article>

          <article className="v1-feat">
            <div className="v1-feat-icon">
              <Ic.lock />
            </div>
            <h3>Unguessable slugs</h3>
            <p>
              Links are 8-character random ids — URL-safe, not indexed, not
              listed. Shareable means shareable on purpose.
            </p>
            <code>/r/V1StGXR8</code>
          </article>

          <article className="v1-feat">
            <div className="v1-feat-icon">
              <Ic.eye />
            </div>
            <h3>Exactly as designed</h3>
            <p>
              No chrome, no banner, no watermark. The page your recipient opens
              is the page you built.
            </p>
            <code>0 ads · 0 pixels</code>
          </article>
        </div>
      </section>

      {/* How it works */}
      <section className="v1-section v1-section--alt" id="how">
        <header className="v1-section-head">
          <span className="v1-section-eyebrow">— How it works</span>
          <h2 className="v1-section-title">Three steps. One minute.</h2>
        </header>

        <ol className="v1-steps">
          <li>
            <span className="v1-step-n">01</span>
            <h4>Drop</h4>
            <p>
              Drag an <code>.html</code> file onto the page, or click to browse.
              We accept single-file HTML up to 1.25&nbsp;MB.
            </p>
          </li>
          <li>
            <span className="v1-step-n">02</span>
            <h4>Sanitize</h4>
            <p>
              Dangerous markup and iframes get stripped; scripts run sealed in a
              sandbox. Everything visual — styles, fonts, SVGs — stays intact.
            </p>
          </li>
          <li>
            <span className="v1-step-n">03</span>
            <h4>Share</h4>
            <p>
              You get a stable URL at{" "}
              <code>dropdoc.sh/r/&lt;slug&gt;</code>. Paste it, print it, or text
              it to your client.
            </p>
          </li>
        </ol>
      </section>

      {/* FAQ */}
      <section className="v1-section" id="faq">
        <header className="v1-section-head">
          <span className="v1-section-eyebrow">— Questions</span>
          <h2 className="v1-section-title">Things worth asking.</h2>
        </header>

        <div className="v1-faq">
          {FAQ.map(([q, a], i) => (
            <details key={i} className="v1-faq-item" open={i === 0}>
              <summary>
                <span>{q}</span>
                <span className="v1-faq-chev">+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="v1-footer">
        <div className="v1-footer-inner">
          <div className="v1-footer-brand">
            <Image
              src="/dropdoc-lockup.png"
              alt="DropDoc"
              width={540}
              height={225}
              style={{ height: 28, width: "auto" }}
            />
            <p>
              A tiny utility from S3 Labs. One page, one input, one output.
            </p>
          </div>
          <div className="v1-footer-cols">
            <div>
              <span className="v1-footer-label">Product</span>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <span className="v1-footer-label">Studio</span>
              <a>S3 Labs</a>
              <a>All products</a>
              <a>Changelog</a>
            </div>
          </div>
        </div>
        <div className="v1-footer-base">
          <span>© 2026 S3 Labs</span>
          <span className="dot">·</span>
          <span>No subscriptions. No ads. No AI branding.</span>
        </div>
      </footer>
    </div>
  );
}

const FAQ: ReadonlyArray<readonly [string, string]> = [
  [
    "Is it really free?",
    "Yes. No card, no account, no paywall. If DropDoc saves you a minute, tips at s3labs.com keep it running — but nothing is gated.",
  ],
  [
    "Do links expire?",
    "No. Once a report is live, the URL is stable. We don't purge, we don't email you a renewal reminder, we don't run a free-trial timer.",
  ],
  [
    "Can I password-protect a report?",
    "Not yet. Slugs are random 8-character URL-safe ids — unguessable, not indexed — which covers most casual sharing. Password protection is on the roadmap.",
  ],
  [
    "What happens to scripts in my HTML?",
    "They run — but inside a locked-down sandbox with no access to DropDoc's cookies, storage, or other reports. We remove <iframe> and other risky markup at upload; styles, fonts, images, and SVG render exactly as designed.",
  ],
  [
    "Can I use a custom domain?",
    "Not today. We might offer a one-time-purchase custom-subdomain tier later. No subscriptions, ever.",
  ],
  [
    "Who made this?",
    "S3 Labs — a tiny studio building simple, inexpensive, useful software. Everything we ship is free or one-time-purchase. Nothing recurring.",
  ],
];

/* ───────── Icons — 1.6–1.75 stroke, round caps ───────── */

const Ic = {
  check: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5 L6.5 12 L13 5" />
    </svg>
  ),
  link: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 9.5 L9.5 6.5" />
      <path d="M9 4.5 L10.5 3 A2.5 2.5 0 0 1 14 6.5 L12.5 8 M7 11.5 L5.5 13 A2.5 2.5 0 0 1 2 9.5 L3.5 8" />
    </svg>
  ),
  external: () => (
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
  ),
  trash: () => (
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
  ),
  search: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L13.5 13.5" />
    </svg>
  ),
  sun: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5 V3" />
      <path d="M8 13 V14.5" />
      <path d="M1.5 8 H3" />
      <path d="M13 8 H14.5" />
      <path d="M3.4 3.4 L4.4 4.4" />
      <path d="M11.6 11.6 L12.6 12.6" />
      <path d="M3.4 12.6 L4.4 11.6" />
      <path d="M11.6 4.4 L12.6 3.4" />
    </svg>
  ),
  moon: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.5 9.5 A5.5 5.5 0 1 1 6.5 2.5 A4.2 4.2 0 0 0 13.5 9.5 Z" />
    </svg>
  ),
  bolt: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 3 L5 13 H11 L10 21 L19 11 H13 L14 3 Z" />
    </svg>
  ),
  wand: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19 L14 10" />
      <path d="M16.5 3.5 L17.4 5.6 L19.5 6.5 L17.4 7.4 L16.5 9.5 L15.6 7.4 L13.5 6.5 L15.6 5.6 Z" />
      <path d="M19.5 11.5 L20 12.7 L21.2 13.2 L20 13.7 L19.5 14.9 L19 13.7 L17.8 13.2 L19 12.7 Z" />
    </svg>
  ),
  infinity: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12 C 4 9, 6.5 7, 9 9 C 11 11, 13 13, 15 15 C 17.5 17, 20 15, 20 12 C 20 9, 17.5 7, 15 9 C 13 11, 11 13, 9 15 C 6.5 17, 4 15, 4 12 Z" />
    </svg>
  ),
  shield: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 L20 6 V12 C 20 16.5, 16.5 20, 12 21 C 7.5 20, 4 16.5, 4 12 V6 L12 3 Z" />
      <path d="M9 12 L11 14 L15 10" />
    </svg>
  ),
  lock: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11 V8 A4 4 0 0 1 16 8 V11" />
    </svg>
  ),
  eye: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12 C 5 6.5, 9 4, 12 4 C 15 4, 19 6.5, 21.5 12 C 19 17.5, 15 20, 12 20 C 9 20, 5 17.5, 2.5 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

function Spinner() {
  return (
    <svg
      className="v1-spinner"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
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
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
