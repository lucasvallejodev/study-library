"use client";

import { useEffect, useState } from "react";
import type { Annotation, HighlightColor } from "@study/core";
import { api } from "./api";

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "pink"];

type Props = {
  annotation: Annotation;
  active: boolean;
  editing: boolean;
  onEdit: (editing: boolean) => void;
  onFocus: () => void;
  onChange: (a: Annotation) => void;
  onDelete: () => void;
  link: string;
  studyPrompt: string;
  notify: (m: string) => void;
};

function quoteOf(a: Annotation): string | undefined {
  const q = a.selectors.find((s) => s.type === "TextQuoteSelector");
  return q?.type === "TextQuoteSelector" ? q.exact : undefined;
}

export function AnnotationCard({ annotation: a, active, editing, onEdit, onFocus, onChange, onDelete, link, studyPrompt, notify }: Props) {
  const [body, setBody] = useState(a.body ?? "");
  const [tags, setTags] = useState(a.tags.join(", "));
  useEffect(() => {
    setBody(a.body ?? "");
    setTags(a.tags.join(", "));
  }, [a.body, a.tags]);
  const quote = quoteOf(a);
  const swatch = a.type === "ai_question" ? "question" : (a.color ?? "yellow");

  async function save() {
    const updated = await api.update(a.id, {
      body: body.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    onChange(updated);
    onEdit(false);
  }

  async function recolor(color: HighlightColor) {
    onChange(await api.update(a.id, { color }));
  }

  async function remove() {
    if (!confirm("Delete this annotation?")) return;
    await api.remove(a.id);
    onDelete();
  }

  return (
    <div
      id={`card-${a.id}`}
      className={`rounded-lg border p-3 text-sm transition ${active ? "border-accent bg-panel shadow-sm" : "border-line"}`}
    >
      {a.type === "ai_question" && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Claude asked</div>}
      {quote && (
        <button onClick={onFocus} className="flex w-full gap-2 text-left">
          <span className={`swatch-${swatch} mt-1 w-1 shrink-0 self-stretch rounded-full`} />
          <span className="line-clamp-4 font-serif text-[0.95rem] leading-snug">{quote}</span>
        </button>
      )}
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
              if (e.key === "Escape") onEdit(false);
            }}
            rows={4}
            placeholder="Write a note (Markdown)… ⌘↵ to save"
            className="w-full rounded border border-line bg-paper p-2 outline-none focus:border-accent"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags, comma separated"
            className="w-full rounded border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button onClick={save} className="rounded bg-accent px-3 py-1 text-white">Save</button>
            <button onClick={() => onEdit(false)} className="rounded px-3 py-1 text-muted hover:bg-panel">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {a.body && <p className="mt-2 whitespace-pre-wrap">{a.body}</p>}
          {a.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {a.tags.map((t) => (
                <a key={t} href={`/notebook?tag=${encodeURIComponent(t)}`} className="rounded-full bg-panel px-2 text-xs text-muted">#{t}</a>
              ))}
            </div>
          )}
        </>
      )}
      {!editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {quote && a.type === "highlight" &&
            COLORS.map((c) => (
              <button key={c} onClick={() => recolor(c)} className={`swatch-${c} size-3 rounded-full ${a.color === c ? "ring-2 ring-ink/40" : ""}`} title={c} />
            ))}
          <button onClick={() => onEdit(true)} className="hover:text-ink">{a.body ? "Edit" : "Add note"}</button>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(location.origin + link).catch(() => {});
              notify("Link copied");
            }}
            className="hover:text-ink"
          >
            Link
          </button>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(studyPrompt).catch(() => {});
              notify("Prompt copied — paste it into Claude Code");
            }}
            className="hover:text-ink"
          >
            Ask Claude
          </button>
          <button onClick={remove} className="ml-auto hover:text-red-600">Delete</button>
        </div>
      )}
    </div>
  );
}
