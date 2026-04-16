"use client";

import { useState, useCallback, useEffect, useRef } from "react";

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

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch {
      // silently fail on list
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

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
      setResults(data.reports ?? []);
      fetchReports();
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
    await fetch(`/api/reports/${slug}`, { method: "DELETE" });
    fetchReports();
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
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Report Share</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Upload HTML reports and share them via link
        </p>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
            transition-colors duration-150
            ${
              dragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
            }
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

          <div className="space-y-2">
            <div className="text-4xl">
              {uploading ? (
                <span className="inline-block animate-spin">&#8635;</span>
              ) : (
                <span className="text-neutral-400">&#8593;</span>
              )}
            </div>
            <p className="text-lg font-medium">
              {uploading
                ? "Uploading..."
                : dragging
                ? "Drop files here"
                : "Drag & drop HTML reports"}
            </p>
            <p className="text-sm text-neutral-500">
              or click to browse &middot; .html files up to 500KB
            </p>
          </div>
        </div>

        {/* Upload results */}
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ${
                  r.error
                    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                    : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                }`}
              >
                <div>
                  <span className="font-medium">{r.title || r.filename}</span>
                  {r.error && <span className="ml-2">&mdash; {r.error}</span>}
                </div>
                {r.slug && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyLink(r.slug!);
                    }}
                    className="ml-4 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors"
                  >
                    {copiedSlug === r.slug ? "Copied!" : "Copy Link"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Dashboard */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Reports{" "}
              <span className="text-neutral-400 font-normal text-sm">
                ({reports.length})
              </span>
            </h2>
            {reports.length > 0 && (
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">
              {reports.length === 0
                ? "No reports uploaded yet. Drop an HTML file above to get started."
                : "No reports match your search."}
            </p>
          ) : (
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3 font-medium">Report</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">
                      Uploaded
                    </th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filtered.map((report) => (
                    <tr
                      key={report.slug}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{report.title}</div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {report.filename}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">
                        {new Date(report.uploadedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => copyLink(report.slug)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          {copiedSlug === report.slug ? "Copied!" : "Copy Link"}
                        </button>
                        <a
                          href={`/r/${report.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          Preview
                        </a>
                        <button
                          onClick={() => handleDelete(report.slug)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
