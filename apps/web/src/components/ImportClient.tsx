"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Warning = { code: string; message: string; chapterId?: string };
type Report = { chapterCount: number; totalWords: number; warnings: Warning[] };
type Job = {
  id: number;
  inputType: string;
  input: string;
  originalName: string | null;
  status: "queued" | "running" | "done" | "failed";
  log: string;
  error: string | null;
  documentId: string | null;
  createdAt: string;
  report?: Report | null;
};

export function ImportClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [expanded, setExpanded] = useState<number>();
  const [reports, setReports] = useState<Record<number, Report | null>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/import/jobs", { cache: "no-store" });
    if (res.ok) setJobs(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const active = jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  useEffect(() => {
    if (expanded === undefined || reports[expanded] !== undefined) return;
    const job = jobs.find((j) => j.id === expanded);
    if (job?.status !== "done") return;
    void fetch(`/api/import/jobs/${expanded}`).then(async (r) => {
      const data = (await r.json()) as Job;
      setReports((m) => ({ ...m, [expanded]: data.report ?? null }));
    });
  }, [expanded, jobs, reports]);

  async function upload(files: FileList | File[]) {
    setError(undefined);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: form });
      if (!res.ok) setError((await res.json()).error);
    }
    await refresh();
  }

  async function importUrl(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    if (!res.ok) setError((await res.json()).error);
    else setUrl("");
    await refresh();
  }

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={`mt-8 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${dragging ? "border-accent bg-panel" : "border-line hover:border-accent"}`}
      >
        <p className="font-serif text-lg">Drop books here or click to choose</p>
        <p className="mt-1 text-sm text-muted">.epub · .mobi · .azw · .azw3 · .html</p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".epub,.mobi,.azw,.azw3,.prc,.html,.htm"
          className="hidden"
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
      </div>

      <form onSubmit={importUrl} className="mt-4 flex gap-2">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/an-article-worth-studying"
          className="flex-1 rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-accent"
        />
        <button className="rounded-md bg-accent px-4 py-2 text-white">Import URL</button>
      </form>
      {error && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-muted">Recent imports</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {jobs.length === 0 && <li className="py-4 text-sm text-muted">No imports yet.</li>}
        {jobs.map((j) => {
          const report = reports[j.id];
          return (
            <li key={j.id} className="py-3 text-sm">
              <button onClick={() => setExpanded(expanded === j.id ? undefined : j.id)} className="flex w-full items-center gap-3 text-left">
                <StatusBadge status={j.status} />
                <span className="flex-1 truncate">{j.originalName ?? j.input}</span>
                <span className="text-xs text-muted">{new Date(j.createdAt).toLocaleString()}</span>
              </button>
              {j.status === "failed" && <p className="mt-2 text-red-600">{j.error}</p>}
              {j.status === "done" && j.documentId && (
                <p className="mt-1">
                  <Link href={`/read/${j.documentId}`} className="text-accent hover:underline">Open {j.documentId} →</Link>
                </p>
              )}
              {(expanded === j.id || j.status === "running") && (
                <div className="mt-2 space-y-2">
                  {report && (
                    <div className="rounded bg-panel p-3">
                      <p>{report.chapterCount} chapters · {report.totalWords.toLocaleString()} words · {report.warnings.length} warnings</p>
                      {report.warnings.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-muted">
                          {report.warnings.slice(0, 50).map((w, i) => <li key={i}><code>{w.code}</code> {w.message}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  {j.log && <pre className="max-h-48 overflow-auto rounded bg-panel p-3 text-xs text-muted">{j.log}</pre>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const styles: Record<Job["status"], string> = {
    queued: "bg-panel text-muted",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return <span className={`w-16 rounded-full px-2 py-0.5 text-center text-xs ${styles[status]}`}>{status}</span>;
}
