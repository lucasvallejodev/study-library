'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  describeRange,
  offsetsFromRange,
  rangeFromOffsets,
  resolveSelectors,
  textOf,
} from '@study/anchoring';
import type { Annotation, HighlightColor } from '@study/core';

import { AnnotationCard } from './annotation-card';
import { api } from './api';
import { ChapterNotes } from './chapter-notes';
import { clearHighlights, paintHighlights, supportsHighlights } from './paint';
import { TocDrawer, type TocItem } from './toc-drawer';

type Props = {
  chapter: { id: string; order: number; sourceUrl?: string; title: string; wordCount: number };
  doc: { authors: string[]; id: string; title: string };
  html: string;
  initialAnnotations: Annotation[];
  initialPosition: number;
  next: { id: string; title: string } | null;
  prev: { id: string; title: string } | null;
  toc: TocItem[];
};

type Popover = {
  end: number;
  left: number;
  start: number;
  top: number;
};
const COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

/** The chapter HTML never re-renders after mount, so painted ranges stay valid. */
const Article = memo(function Article({
  articleRef,
  html,
}: {
  articleRef: React.RefObject<HTMLElement | null>;
  html: string;
}) {
  return (
    <article
      ref={articleRef}
      className="reader-prose prose prose-lg max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export function Reader(props: Props) {
  const { chapter, doc } = props;
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
  const [editingId, setEditingId] = useState<string>();
  const [hoverId, setHoverId] = useState<string>();
  const [marginMode, setMarginMode] = useState<'notes' | 'all'>('notes');
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(undefined), 2200);
  }, []);

  /** Path of an annotation's deep link; copy handlers prepend location.origin. */
  const link = useCallback(
    (id: string) => `/read/${doc.id}/${chapter.id}#${id}`,
    [doc.id, chapter.id]
  );

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

      if (range && anchor && (a.orphaned || anchor.quality !== 'exact')) {
        void api
          .update(a.id, {
            orphaned: false,
            selectors: describeRange(text, anchor.start, anchor.end),
          })
          .catch(() => {});
      }
    }

    setRanges(next);
    setAnchored(true);
  }, [annotations]);

  useEffect(() => {
    paintHighlights(
      annotations.filter(a => ranges.has(a.id)).map(a => ({ a, range: ranges.get(a.id)! })),
      hoverId ?? activeId
    );
  }, [ranges, annotations, activeId, hoverId]);
  useEffect(() => clearHighlights, []);

  const ordered = useMemo(() => {
    const placed = annotations.filter(a => ranges.has(a.id));

    placed.sort((x, y) =>
      ranges.get(x.id)!.compareBoundaryPoints(Range.START_TO_START, ranges.get(y.id)!)
    );

    return placed;
  }, [annotations, ranges]);

  // Google Docs style: notes and Claude's questions sit beside their passage; plain highlights
  // join them when selected or when the margin is set to show everything.
  const marginItems = ordered.filter(
    a =>
      marginMode === 'all' ||
      a.body ||
      a.type === 'ai_question' ||
      a.id === activeId ||
      a.id === editingId
  );

  const marginRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [tops, setTops] = useState<Record<string, number>>({});
  const [layoutTick, setLayoutTick] = useState(0);
  // Cards appear in place the first time they are positioned; only later moves are animated.
  const placedRef = useRef(new Set<string>());

  useEffect(() => {
    for (const id of Object.keys(tops)) placedRef.current.add(id);
  }, [tops]);

  useEffect(() => {
    try {
      if (localStorage.getItem('marginMode') === 'all') setMarginMode('all');
    } catch {}

    const bump = () => setLayoutTick(n => n + 1);
    const observer = new ResizeObserver(bump);

    if (articleRef.current) observer.observe(articleRef.current);
    window.addEventListener('resize', bump);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', bump);
    };
  }, []);

  useLayoutEffect(() => {
    const margin = marginRef.current;

    if (!margin || margin.offsetParent === null) return; // margin hidden below xl

    for (const id of cardRefs.current.keys()) {
      if (!marginItems.some(a => a.id === id)) cardRefs.current.delete(id);
    }

    const origin = margin.getBoundingClientRect().top;
    const gap = 8;

    const items = marginItems.map(a => ({
      height: cardRefs.current.get(a.id)?.offsetHeight ?? 96,
      id: a.id,
      want: ranges.get(a.id)!.getBoundingClientRect().top - origin,
    }));

    const pos = new Array<number>(items.length);

    // The focused card sits exactly beside its passage; the others make room above and below it.
    const pin = Math.max(
      0,
      items.findIndex(i => i.id === (editingId ?? activeId))
    );

    pos[pin] = items[pin] ? Math.max(0, items[pin].want) : 0;

    for (let i = pin + 1; i < items.length; i++) {
      pos[i] = Math.max(items[i].want, pos[i - 1] + items[i - 1].height + gap);
    }

    for (let i = pin - 1; i >= 0; i--) {
      pos[i] = Math.min(items[i].want, pos[i + 1] - items[i].height - gap);
    }

    const next: Record<string, number> = {};

    items.forEach((item, i) => (next[item.id] = pos[i]!));
    setTops(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });

  const orphans = annotations.filter(a => a.selectors.length > 0 && !ranges.has(a.id));
  const chapterNotes = annotations.filter(a => a.selectors.length === 0 && a.type !== 'bookmark');
  const bookmark = annotations.find(a => a.type === 'bookmark');

  // ---- Deep links: #a-xxxx scrolls to the passage and pulses it ----
  const focusAnnotation = useCallback(
    (id: string, scroll = true) => {
      setActiveId(id);
      const range = ranges.get(id);

      if (range && scroll) {
        const rect = range.getBoundingClientRect();

        window.scrollTo({
          behavior: 'smooth',
          top: window.scrollY + rect.top - window.innerHeight / 3,
        });
      }

      document
        .getElementById(`card-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      clearTimeout(pulseTimer.current);

      // Deep links and card clicks pulse briefly; clicking the text itself keeps the card selected.
      if (scroll) {
        pulseTimer.current = setTimeout(
          () => setActiveId(cur => (cur === id ? undefined : cur)),
          2500
        );
      }
    },
    [ranges]
  );

  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || !articleRef.current || !anchored) return;
    restored.current = true;
    const hash = decodeURIComponent(location.hash.slice(1));

    if (hash.startsWith('a-')) {
      if (ranges.has(hash)) focusAnnotation(hash);
      else {
        setActiveId(hash);
        setSheetOpen(true);
        document.getElementById(`card-${hash}`)?.scrollIntoView({ block: 'center' });
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

      if (hash.startsWith('a-')) focusAnnotation(hash);
    };

    window.addEventListener('hashchange', onHash);

    return () => window.removeEventListener('hashchange', onHash);
  }, [focusAnnotation]);

  // ---- Reading progress ----
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = props.initialPosition;

    const send = (beacon = false) => {
      const body = JSON.stringify({
        chapterId: chapter.id,
        documentId: doc.id,
        position: latest,
      });

      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/progress', new Blob([body], { type: 'application/json' }));
      } else {
        void fetch('/api/progress', {
          body,
          headers: { 'content-type': 'application/json' },
          keepalive: true,
          method: 'POST',
        });
      }
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

    const onHide = () => document.visibilityState === 'hidden' && send(true);

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHide);
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
        let { end, start } = offsets;

        while (start < end && /\s/.test(text[start])) start++;
        while (end > start && /\s/.test(text[end - 1])) end--;
        if (end <= start) return setPopover(null);
        const rect = range.getBoundingClientRect();
        const origin = wrapperRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };

        setPopover({
          end,
          left:
            Math.max(8, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 150)) -
            origin.left,
          start,
          top: rect.bottom - origin.top + 8,
        });
      }, 10);

    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
    document.addEventListener('keyup', onUp);

    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('keyup', onUp);
    };
  }, []);

  // Click on painted text opens its card (no DOM nodes to attach handlers to).
  const onArticleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!window.getSelection()?.isCollapsed) return;
      const target = e.target as HTMLElement;

      if (target.closest('a')) return;

      if (!supportsHighlights()) {
        const id = target.closest('mark[data-annotation]')?.getAttribute('data-annotation');

        if (id) focusAnnotation(id, false);

        return;
      }

      const doc = document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number
        ) => { offset: number; offsetNode: Node } | null;
      };

      const pos = doc.caretPositionFromPoint?.(e.clientX, e.clientY);

      const node =
        pos?.offsetNode ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer;

      const offset =
        pos?.offset ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startOffset ?? 0;

      if (!node) return;

      const hit = ordered.find(a => {
        try {
          return ranges.get(a.id)!.isPointInRange(node, offset);
        } catch {
          return false;
        }
      });

      if (hit) {
        focusAnnotation(hit.id, false);
        if (window.innerWidth < 1280) setSheetOpen(true);
      } else if (!editingId) setActiveId(undefined);
    },
    [ordered, ranges, focusAnnotation, editingId]
  );

  async function createFromSelection(opts: {
    color?: HighlightColor;
    withNote?: boolean;
  }): Promise<Annotation | undefined> {
    const root = articleRef.current;

    if (!popover || !root) return;
    const selectors = describeRange(textOf(root), popover.start, popover.end);

    try {
      const created = await api.create({
        chapterId: chapter.id,
        color: opts.color ?? 'yellow',
        documentId: doc.id,
        selectors,
        type: 'highlight',
      });

      setAnnotations(list => [...list, created]);
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

  async function copyLink() {
    const a = await createFromSelection({});

    if (!a) return;
    await navigator.clipboard.writeText(location.origin + link(a.id)).catch(() => {});
    history.replaceState(null, '', `#${a.id}`);
    flash('Link copied');
  }

  async function askClaude() {
    const a = await createFromSelection({ color: 'blue' });

    if (!a) return;
    await navigator.clipboard
      .writeText(`/study ${doc.id} ${chapter.id} --focus ${a.id}`)
      .catch(() => {});
    flash('Prompt copied — paste it into Claude Code');
  }

  const updateLocal = (updated: Annotation) =>
    setAnnotations(list => list.map(a => (a.id === updated.id ? updated : a)));

  const removeLocal = (id: string) => setAnnotations(list => list.filter(a => a.id !== id));

  async function toggleBookmark() {
    if (bookmark) {
      await api.remove(bookmark.id);
      removeLocal(bookmark.id);
      flash('Bookmark removed');
    } else {
      const created = await api.create({
        body: null,
        chapterId: chapter.id,
        documentId: doc.id,
        type: 'bookmark',
      });

      setAnnotations(list => [...list, created]);
      flash('Chapter bookmarked');
    }
  }

  // ---- Keyboard: ← → for chapters, Esc closes panels ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;

      if (el.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (e.key === 'ArrowRight' && props.next) router.push(`/read/${doc.id}/${props.next.id}`);
      if (e.key === 'ArrowLeft' && props.prev) router.push(`/read/${doc.id}/${props.prev.id}`);

      if (e.key === 'Escape') {
        setTocOpen(false);
        setSheetOpen(false);
        setPopover(null);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [router, doc.id, props.next, props.prev]);

  const cards = (
    <div className="space-y-3">
      {ordered.length === 0 && orphans.length === 0 && (
        <p className="text-sm text-muted">Select text to highlight it or add a note.</p>
      )}
      {ordered.map(a => (
        <AnnotationCard
          key={a.id}
          annotation={a}
          active={a.id === activeId}
          editing={a.id === editingId}
          onEdit={v => {
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
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Orphaned ({orphans.length})
          </h3>
          <p className="mb-2 text-xs text-muted">
            The text changed and these passages could not be found.
          </p>
          {orphans.map(a => (
            <AnnotationCard
              key={a.id}
              annotation={a}
              active={a.id === activeId}
              editing={a.id === editingId}
              onEdit={v => setEditingId(v ? a.id : undefined)}
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
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="sticky top-14 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-4 text-sm">
          <button
            onClick={() => setTocOpen(true)}
            className="shrink-0 whitespace-nowrap rounded px-2 py-1 hover:bg-panel"
            aria-label="Table of contents"
          >
            ☰<span className="hidden sm:inline"> Contents</span>
          </button>
          <Link
            href={`/read/${doc.id}`}
            className="hidden truncate text-muted hover:text-ink sm:block"
          >
            {doc.title}
          </Link>
          <span className="hidden text-muted sm:inline">/</span>
          <span className="truncate">{chapter.title}</span>
          <span className="ml-auto shrink-0 text-xs text-muted">{Math.round(progress * 100)}%</span>
          <button
            onClick={toggleBookmark}
            className="rounded px-2 py-1 hover:bg-panel"
            title={bookmark ? 'Remove bookmark' : 'Bookmark chapter'}
          >
            {bookmark ? '★' : '☆'}
          </button>
          <button
            onClick={() => setSheetOpen(v => !v)}
            className="shrink-0 whitespace-nowrap rounded px-2 py-1 hover:bg-panel xl:hidden"
          >
            Notes{count > 0 && ` (${count})`}
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 xl:grid-cols-[minmax(0,1fr)_680px_minmax(300px,1fr)]">
        <div className="hidden xl:block" />
        <main className="min-w-0 py-10">
          {chapter.sourceUrl && (
            <a
              href={chapter.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-6 block truncate text-sm text-muted hover:text-accent"
            >
              Source: {chapter.sourceUrl}
            </a>
          )}
          <div onClick={onArticleClick} className="mx-auto max-w-[680px]">
            <Article html={props.html} articleRef={articleRef} />
          </div>

          {orphans.length > 0 && (
            <section className="mx-auto mt-12 hidden max-w-[680px] xl:block">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Orphaned notes ({orphans.length})
              </h2>
              <p className="mb-3 text-xs text-muted">
                The text changed and these passages could not be found.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {orphans.map(a => (
                  <AnnotationCard
                    key={a.id}
                    annotation={a}
                    active={a.id === activeId}
                    editing={a.id === editingId}
                    onEdit={v => setEditingId(v ? a.id : undefined)}
                    onFocus={() => setActiveId(a.id)}
                    onChange={updateLocal}
                    onDelete={() => removeLocal(a.id)}
                    link={link(a.id)}
                    studyPrompt={`/study ${doc.id} ${chapter.id} --focus ${a.id}`}
                    notify={flash}
                  />
                ))}
              </div>
            </section>
          )}

          <ChapterNotes
            documentId={doc.id}
            chapterId={chapter.id}
            notes={chapterNotes}
            onCreate={a => setAnnotations(list => [...list, a])}
            onChange={updateLocal}
            onDelete={removeLocal}
            link={link}
            notify={flash}
          />

          <nav className="mx-auto mt-12 grid max-w-[680px] grid-cols-2 gap-4 border-t border-line pt-6 text-sm">
            {props.prev ? (
              <Link
                href={`/read/${doc.id}/${props.prev.id}`}
                className="rounded-lg border border-line p-3 hover:border-accent"
              >
                <div className="text-xs text-muted">← Previous</div>
                <div className="truncate font-serif">{props.prev.title}</div>
              </Link>
            ) : (
              <span />
            )}
            {props.next ? (
              <Link
                href={`/read/${doc.id}/${props.next.id}`}
                className="rounded-lg border border-line p-3 text-right hover:border-accent"
              >
                <div className="text-xs text-muted">Next →</div>
                <div className="truncate font-serif">{props.next.title}</div>
              </Link>
            ) : (
              <Link
                href={`/read/${doc.id}`}
                className="rounded-lg border border-line p-3 text-right hover:border-accent"
              >
                <div className="text-xs text-muted">Finished</div>
                <div className="truncate font-serif">Back to contents</div>
              </Link>
            )}
          </nav>
        </main>

        <aside className="hidden py-10 xl:block">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wider">Notes</span>
            <button
              onClick={() => {
                const next = marginMode === 'all' ? 'notes' : 'all';

                setMarginMode(next);

                try {
                  localStorage.setItem('marginMode', next);
                } catch {}
              }}
              className="ml-auto rounded px-1.5 py-0.5 hover:bg-panel hover:text-ink"
              title="Show every highlight in the margin, or only the ones with notes"
            >
              {marginMode === 'all' ? 'All highlights' : 'With notes'} ▾
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard
                  .writeText(`/highlight-notes ${doc.id} ${chapter.id}`)
                  .catch(() => {});
                flash('Prompt copied — paste it into Claude Code');
              }}
              className="rounded px-1.5 py-0.5 hover:bg-panel hover:text-ink"
              title="Copy a Claude Code prompt that writes notes on this chapter's highlights"
            >
              ✦ Claude notes
            </button>
          </div>
          <div ref={marginRef} className="relative" style={{ minHeight: '100%' }}>
            {marginItems.length === 0 && (
              <p className="text-sm text-muted">
                Select text to highlight it, then add a note. Notes appear here, beside their
                passage.
              </p>
            )}
            {marginItems.map(a => (
              <div
                key={a.id}
                ref={el => {
                  if (!el) return; // stale entries are pruned by the layout effect
                  const isNew = !cardRefs.current.has(a.id);

                  cardRefs.current.set(a.id, el);
                  // A new card (e.g. a note just created) needs a layout pass once it can be measured.
                  if (isNew) requestAnimationFrame(() => setLayoutTick(n => n + 1));
                }}
                className={`absolute inset-x-0 ${placedRef.current.has(a.id) ? 'transition-[top] duration-200' : ''}`}
                style={{ opacity: a.id in tops ? 1 : 0, top: tops[a.id] ?? 0 }}
                onMouseEnter={() => setHoverId(a.id)}
                onMouseLeave={() => setHoverId(undefined)}
              >
                <AnnotationCard
                  annotation={a}
                  compact
                  active={a.id === activeId}
                  editing={a.id === editingId}
                  onEdit={v => {
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
              </div>
            ))}
          </div>
        </aside>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-line bg-paper p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                In this chapter
              </h2>
              <button onClick={() => setSheetOpen(false)} className="text-sm text-muted">
                Close
              </button>
            </div>
            {cards}
          </div>
        </div>
      )}

      {popover && (
        <div
          className="absolute z-40 flex items-center gap-1 rounded-lg border border-line bg-panel p-1.5 font-sans text-sm shadow-xl ring-1 ring-black/5"
          style={{ left: popover.left, top: popover.top }}
          onMouseUp={e => e.stopPropagation()}
          onMouseDown={e => e.preventDefault()}
        >
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => createFromSelection({ color: c })}
              className={`swatch-${c} size-6 rounded-full ring-1 ring-black/10 hover:scale-110`}
              title={`Highlight ${c}`}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <button
            onClick={() => createFromSelection({ withNote: true })}
            className="rounded px-2 py-1 hover:bg-panel"
          >
            Note
          </button>
          <button onClick={copyLink} className="rounded px-2 py-1 hover:bg-panel">
            Link
          </button>
          <button
            onClick={askClaude}
            className="rounded px-2 py-1 hover:bg-panel"
            title="Highlight and copy a /study prompt for Claude Code"
          >
            Ask Claude
          </button>
        </div>
      )}

      <TocDrawer
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        docId={doc.id}
        docTitle={doc.title}
        currentId={chapter.id}
        items={props.toc}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
