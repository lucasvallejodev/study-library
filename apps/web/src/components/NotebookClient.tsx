"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FreeNoteForm() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  async function save() {
    if (!body.trim()) return;
    await fetch("/api/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", body: body.trim() }),
    });
    setBody("");
    setOpen(false);
    router.refresh();
  }
  if (!open) {
    return (
      <div className="mt-4 flex gap-4 text-sm">
        <button onClick={() => setOpen(true)} className="text-accent hover:underline">+ New free-floating note</button>
        <ExportAll />
      </div>
    );
  }
  return (
    <div className="mt-4">
      <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="A thought that isn't tied to a passage…" className="w-full rounded-lg border border-line bg-panel p-3 text-sm outline-none focus:border-accent" />
      <div className="mt-2 flex gap-2 text-sm">
        <button onClick={save} className="rounded bg-accent px-3 py-1 text-white">Save</button>
        <button onClick={() => setOpen(false)} className="rounded px-3 py-1 text-muted">Cancel</button>
      </div>
    </div>
  );
}

function ExportAll() {
  const [msg, setMsg] = useState<string>();
  async function run() {
    const res = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const data = (await res.json()) as { id: string; count: number }[];
    setMsg(res.ok ? `Exported ${data.reduce((n, d) => n + d.count, 0)} annotations to each document folder` : "Export failed");
  }
  return (
    <>
      <button onClick={run} className="text-muted hover:text-ink">Back up all annotations</button>
      {msg && <span className="text-muted">{msg}</span>}
    </>
  );
}

export function NotebookItemActions({ id, href }: { id: string; href?: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  return (
    <span className="ml-auto flex gap-3 text-muted">
      {href && (
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(`${location.origin}${href}`).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="hover:text-ink"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      )}
      <button
        onClick={async () => {
          if (!confirm("Delete this annotation?")) return;
          await fetch(`/api/annotations/${id}`, { method: "DELETE" });
          router.refresh();
        }}
        className="hover:text-red-600"
      >
        Delete
      </button>
    </span>
  );
}
