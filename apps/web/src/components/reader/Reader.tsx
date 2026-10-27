"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { describeRange, offsetsFromRange, rangeFromOffsets, resolveSelectors, textOf } from "@study/anchoring";
import type { Annotation, HighlightColor } from "@study/core";
import { api } from "./api";
import { clearHighlights, paintHighlights, supportsHighlights } from "./paint";
import { AnnotationCard } from "./AnnotationCard";
import { ChapterNotes } from "./ChapterNotes";
import { TocDrawer, type TocItem } from "./TocDrawer";

type Props = {
  doc: { id: string; title: string; authors: string[] };
  chapter: { id: string; title: string; order: number; wordCount: number; sourceUrl?: string };
  toc: TocItem[];
  html: string;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  initialAnnotations: Annotation[];
  initialPosition: number;
};

type Popover = { top: number; left: number; start: number; end: number };
const COLORS: HighlightColor[] = ["yellow", "green", "blue", "pink"];

/** The chapter HTML never re-renders after mount, so painted ranges stay valid. */
const Article = memo(function Article({ html, articleRef }: { html: string; articleRef: React.RefObject<HTMLElement | null> }) {
  return (
    <article
      ref={articleRef}
      className="reader-prose prose prose-lg max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export function Reader(props: Props) {
  const { doc, chapter } = props;
  const router = useRouter();
  const articleRef = useRef<HTMLElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState(props.initialAnnotations);
  const [ranges, setRanges] = useState<Map<string, Range>>(new Map());
  const [anchored, setAnchored] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [popover, setPopover] = useState<Popover | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const [progress, setProgress] = useState(props.initialPosition);
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(undefined), 2200);
  }, []);

  /** Path of an annotation's deep link; copy handlers prepend location.origin. */
  const link = useCallback((id: string) => `/read/${doc.id}/${chapter.id}#${id}`, [doc.id, chapter.id]);

  // ---- Anchor annotations to the rendered text ----
  useLayoutEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const text = textOf(root);
    const next = new Map<string, Range>();
    for (const a of annotations) {
      if (!a.selectors.length) continue;
      const anchor = resolveSelectors(text, a.selectors);
      const range = anchor && rangeFromOffsets(root, anchor.start, anchor.end);
      if (range) next.set(a.id, range);
      // Keep the stored state honest: orphan flags and refreshed selectors after a re-import.
      if (!range && !a.orphaned) void api.update(a.id, { orphaned: true }).catch(() => {});
      if (range && anchor && (a.orphaned || anchor.quality !== "exact")) {
        void api.update(a.id, { orphaned: false, selectors: describeRange(text, anchor.start, anchor.end) }).catch(() => {});
      }
    }
    setRanges(next);
    setAnchored(true);
  }, [annotations]);

  useEffect(() => {
    paintHighlights(
      annotations.filter((a) => ranges.has(a.id)).map((a) => ({ a, range: ranges.get(a.id)! })),
      activeId,
    );
  }, [ranges, annotations, activeId]);
  useEffect(() => clearHighlights, []);

  const ordered = useMemo(() => {
    const placed = annotations.filter((a) => ranges.has(a.id));
    placed.sort((x, y) => ranges.get(x.id)!.compareBoundaryPoints(Range.START_TO_START, ranges.get(y.id)!));
    return placed;
  }, [annotations, ranges]);
  const orphans = annotations.filter((a) => a.selectors.length > 0 && !ranges.has(a.id));
  const chapterNotes = annotations.filter((a) => a.selectors.length === 0 && a.type !== "bookmark");
  const bookmark = annotations.find((a) => a.type === "bookmark");

  // ---- Deep links: #a-xxxx scrolls to the passage and pulses it ----
  const focusAnnotation = useCallback(
    (id: string, scroll = true) => {
      setActiveId(id);
      const range = ranges.get(id);
      if (range && scroll) {
        const rect = range.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 3, behavior: "smooth" });
      }
      document.getElementById(`card-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setActiveId((cur) => (cur === id ? undefined : cur)), 2500);
    },
    [ranges],
  );

  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !articleRef.current || !anchored) return;
    restored.current = true;
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash.startsWith("a-")) {
      if (ranges.has(hash)) focusAnnotation(hash);
      else {
        setActiveId(hash);
        setSheetOpen(true);
        document.getElementById(`card-${hash}`)?.scrollIntoView({ block: "center" });
      }
      return;
    }
    if (hash) return;
    const pos = props.initialPosition;
    if (pos > 0.02 && pos < 0.98) {
      const el = articleRef.current;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + pos * el.offsetHeight - window.innerHeight * 0.3 });
    }
  }, [anchored, ranges, focusAnnotation, props.initialPosition]);

  useEffect(() => {
    const onHash = () => {
      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash.startsWith("a-")) focusAnnotation(hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [focusAnnotation]);

  // ---- Reading progress ----
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = props.initialPosition;
    const send = (beacon = false) => {
      const body = JSON.stringify({ documentId: doc.id, chapterId: chapter.id, position: latest });
      if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/progress", new Blob([body], { type: "application/json" }));
      else void fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
    };
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(1, el.offsetHeight - window.innerHeight * 0.5);
      latest = Math.max(0, Math.min(1, (window.scrollY - top + window.innerHeight * 0.5) / height));
      setProgress(latest);
      clearTimeout(timer);
      timer = setTimeout(() => send(), 1200);
    };
    const onHide = () => document.visibilityState === "hidden" && send(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [doc.id, chapter.id, props.initialPosition]);

  // ---- Selection popover ----
  useEffect(() => {
    const onUp = () =>
      setTimeout(() => {
        const sel = window.getSelection();
        const root = articleRef.current;
        if (!sel || sel.isCollapsed || !root || sel.rangeCount === 0) return setPopover(null);
        const range = sel.getRangeAt(0);
        const offsets = offsetsFromRange(root, range);
        if (!offsets) return setPopover(null);
        const text = textOf(root);
        let { start, end } = offsets;
        while (start < end && /\s/.test(text[start]!)) start++;
        while (end > start && /\s/.test(text[end - 1]!)) end--;
        if (end <= start) return setPopover(null);
        const rect = range.getBoundingClientRect();
        const origin = wrapperRef.current?.getBoundingClientRect() ?? { top: 0, left: 0 };
        setPopover({
          top: rect.bottom - origin.top + 8,
          left: Math.max(8, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 150)) - origin.left,
          start,
          end,
        });
      }, 10);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("keyup", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("keyup", onUp);
    };
  }, []);

  // Click on painted text opens its card (no DOM nodes to attach handlers to).
  const onArticleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!window.getSelection()?.isCollapsed) return;
      const target = e.target as HTMLElement;
      if (target.closest("a")) return;
      if (!supportsHighlights()) {
        const id = target.closest("mark[data-annotation]")?.getAttribute("data-annotation");
        if (id) focusAnnotation(id, false);
        return;
      }
      const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
      const pos = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
      const node = pos?.offsetNode ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer;
      const offset = pos?.offset ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startOffset ?? 0;
      if (!node) return;
      const hit = ordered.find((a) => {
        try {
          return ranges.get(a.id)!.isPointInRange(node, offset);
        } catch {
          return false;
        }
      });
      if (hit) {
        focusAnnotation(hit.id, false);
        if (window.innerWidth < 1280) setSheetOpen(true);
      }
    },
    [ordered, ranges, focusAnnotation],
  );

  async function createFromSelection(opts: { color?: HighlightColor; withNote?: boolean }): Promise<Annotation | undefined> {
    const root = articleRef.current;
    if (!popover || !root) return;
    const selectors = describeRange(textOf(root), popover.start, popover.end);
    try {
      const created = await api.create({
        documentId: doc.id,
        chapterId: chapter.id,
        type: "highlight",
        color: opts.color ?? "yellow",
        selectors,
      });
      setAnnotations((list) => [...list, created]);
      window.getSelection()?.removeAllRanges();
      setPopover(null);
      if (opts.withNote) {
        setActiveId(created.id);
        setEditingId(created.id);
        if (window.innerWidth < 1280) setSheetOpen(true);
      }
      return created;
    } catch (e) {
      flash((e as Error).message);
    }
  }

  const [editingId, setEditingId] = useState<string>();

  async function copyLink() {
    const a = await createFromSelection({});
    if (!a) return;
    await navigator.clipboard.writeText(location.origin + link(a.id)).catch(() => {});
    history.replaceState(null, "", `#${a.id}`);
    flash("Link copied");
  }

  async function askClaude() {
    const a = await createFromSelection({ color: "blue" });
    if (!a) return;
    await navigator.clipboard.writeText(`/study ${doc.id} ${chapter.id} --focus ${a.id}`).catch(() => {});
    flash("Prompt copied — paste it into Claude Code");
  }

  const updateLocal = (updated: Annotation) => setAnnotations((list) => list.map((a) => (a.id === updated.id ? updated : a)));
  const removeLocal = (id: string) => setAnnotations((list) => list.filter((a) => a.id !== id));

  async function toggleBookmark() {
    if (bookmark) {
      await api.remove(bookmark.id);
      removeLocal(bookmark.id);
      flash("Bookmark removed");
    } else {
      const created = await api.create({ documentId: doc.id, chapterId: chapter.id, type: "bookmark", body: null });
      setAnnotations((list) => [...list, created]);
      flash("Chapter bookmarked");
    }
  }

  // ---- Keyboard: ← → for chapters, Esc closes panels ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" && props.next) router.push(`/read/${doc.id}/${props.next.id}`);
      if (e.key === "ArrowLeft" && props.prev) router.push(`/read/${doc.id}/${props.prev.id}`);
      if (e.key === "Escape") {
        setTocOpen(false);
        setSheetOpen(false);
        setPopover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, doc.id, props.next, props.prev]);

  const cards = (
    <div className="space-y-3">
      {ordered.length === 0 && orphans.length === 0 && (
        <p className="text-sm text-muted">Select text to highlight it or add a note.</p>
      )}
      {ordered.map((a) => (
        <AnnotationCard
          key={a.id}
          annotation={a}
          active={a.id === activeId}
          editing={a.id === editingId}
          onEdit={(v) => {
            setEditingId(v ? a.id : undefined);
            if (!v) setActiveId(undefined);
          }}
          onFocus={() => focusAnnotation(a.id)}
          onChange={updateLocal}
          onDelete={() => removeLocal(a.id)}
          link={link(a.id)}
          studyPrompt={`/study ${doc.id} ${chapter.id} --focus ${a.id}`}
          notify={flash}
        />
      ))}
      {orphans.length > 0 && (
        <div className="pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Orphaned ({orphans.length})</h3>
          <p className="mb-2 text-xs text-muted">The text changed and these passages could not be found.</p>
          {orphans.map((a) => (
            <AnnotationCard
              key={a.id}
              annotation={a}
              active={a.id === activeId}
              editing={a.id === editingId}
              onEdit={(v) => setEditingId(v ? a.id : undefined)}
              onFocus={() => setActiveId(a.id)}
              onChange={updateLocal}
              onDelete={() => removeLocal(a.id)}
              link={link(a.id)}
              studyPrompt={`/study ${doc.id} ${chapter.id} --focus ${a.id}`}
              notify={flash}
            />
          ))}
        </div>
      )}
    </div>
  );

  const count = ordered.length + orphans.length;

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className="sticky top-14 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-4 text-sm">
          <button onClick={() => setTocOpen(true)} className="shrink-0 whitespace-nowrap rounded px-2 py-1 hover:bg-panel" aria-label="Table of contents">
            ☰<span className="hidden sm:inline"> Contents</span>
          </button>
          <Link href={`/read/${doc.id}`} className="hidden truncate text-muted hover:text-ink sm:block">{doc.title}</Link>
          <span className="hidden text-muted sm:inline">/</span>
          <span className="truncate">{chapter.title}</span>
          <span className="ml-auto shrink-0 text-xs text-muted">{Math.round(progress * 100)}%</span>
          <button onClick={toggleBookmark} className="rounded px-2 py-1 hover:bg-panel" title={bookmark ? "Remove bookmark" : "Bookmark chapter"}>
            {bookmark ? "★" : "☆"}
          </button>
          <button onClick={() => setSheetOpen((v) => !v)} className="shrink-0 whitespace-nowrap rounded px-2 py-1 hover:bg-panel xl:hidden">Notes{count > 0 && ` (${count})`}</button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 xl:grid-cols-[1fr_680px_1fr]">
        <div className="hidden xl:block" />
        <main className="min-w-0 py-10">
          {chapter.sourceUrl && (
            <a href={chapter.sourceUrl} target="_blank" rel="noreferrer" className="mb-6 block truncate text-sm text-muted hover:text-accent">
              Source: {chapter.sourceUrl}
            </a>
          )}
          <div onClick={onArticleClick} className="mx-auto max-w-[680px]">
            <Article html={props.html} articleRef={articleRef} />
          </div>

          <ChapterNotes
            documentId={doc.id}
            chapterId={chapter.id}
            notes={chapterNotes}
            onCreate={(a) => setAnnotations((list) => [...list, a])}
            onChange={updateLocal}
            onDelete={removeLocal}
            link={link}
            notify={flash}
          />

          <nav className="mx-auto mt-12 grid max-w-[680px] grid-cols-2 gap-4 border-t border-line pt-6 text-sm">
            {props.prev ? (
              <Link href={`/read/${doc.id}/${props.prev.id}`} className="rounded-lg border border-line p-3 hover:border-accent">
                <div className="text-xs text-muted">← Previous</div>
                <div className="truncate font-serif">{props.prev.title}</div>
              </Link>
            ) : <span />}
            {props.next ? (
              <Link href={`/read/${doc.id}/${props.next.id}`} className="rounded-lg border border-line p-3 text-right hover:border-accent">
                <div className="text-xs text-muted">Next →</div>
                <div className="truncate font-serif">{props.next.title}</div>
              </Link>
            ) : (
              <Link href={`/read/${doc.id}`} className="rounded-lg border border-line p-3 text-right hover:border-accent">
                <div className="text-xs text-muted">Finished</div>
                <div className="truncate font-serif">Back to contents</div>
              </Link>
            )}
          </nav>
        </main>

        <aside className="hidden py-10 xl:block">
          <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">In this chapter {count > 0 && `(${count})`}</h2>
            {cards}
          </div>
        </aside>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-line bg-paper p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">In this chapter</h2>
              <button onClick={() => setSheetOpen(false)} className="text-sm text-muted">Close</button>
            </div>
            {cards}
          </div>
        </div>
      )}

      {popover && (
        <div
          className="absolute z-40 flex items-center gap-1 rounded-lg border border-line bg-panel p-1.5 font-sans text-sm shadow-xl ring-1 ring-black/5"
          style={{ top: popover.top, left: popover.left }}
          onMouseUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {COLORS.map((c) => (
            <button key={c} onClick={() => createFromSelection({ color: c })} className={`swatch-${c} size-6 rounded-full ring-1 ring-black/10 hover:scale-110`} title={`Highlight ${c}`} />
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <button onClick={() => createFromSelection({ withNote: true })} className="rounded px-2 py-1 hover:bg-panel">Note</button>
          <button onClick={copyLink} className="rounded px-2 py-1 hover:bg-panel">Link</button>
          <button onClick={askClaude} className="rounded px-2 py-1 hover:bg-panel" title="Highlight and copy a /study prompt for Claude Code">Ask Claude</button>
        </div>
      )}

      <TocDrawer open={tocOpen} onClose={() => setTocOpen(false)} docId={doc.id} docTitle={doc.title} currentId={chapter.id} items={props.toc} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg">{toast}</div>
      )}
    </div>
  );
}
