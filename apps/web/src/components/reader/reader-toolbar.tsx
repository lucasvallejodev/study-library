'use client';

import Link from 'next/link';

import { roundedPercent } from '../ui';
import type { ReaderDocument } from './reader-types';

type ReaderToolbarProps = {
  bookmarked: boolean;
  chapterTitle: string;
  doc: ReaderDocument;
  noteCount: number;
  onCopyClaudeNotesPrompt: () => Promise<void>;
  onOpenToc: () => void;
  onToggleBookmark: () => Promise<void>;
  onToggleSheet: () => void;
  progress: number;
};

export function ReadingProgressBar({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
      <div
        className="h-full bg-accent transition-[width]"
        style={{ width: `${roundedPercent(progress)}%` }}
      />
    </div>
  );
}

export function ReaderToolbar(props: ReaderToolbarProps) {
  const { bookmarked, chapterTitle, doc, noteCount, progress } = props;

  return (
    <div className="sticky top-14 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-4 text-sm">
        <button
          onClick={props.onOpenToc}
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
        <span className="truncate">{chapterTitle}</span>
        <span className="ml-auto shrink-0 text-xs text-muted">{roundedPercent(progress)}%</span>
        <button
          onClick={props.onToggleBookmark}
          className="rounded px-2 py-1 hover:bg-panel"
          title={bookmarked ? 'Remove bookmark' : 'Bookmark chapter'}
        >
          {bookmarked ? '★' : '☆'}
        </button>
        <button
          onClick={props.onCopyClaudeNotesPrompt}
          className="hidden shrink-0 whitespace-nowrap rounded px-2 py-1 text-muted hover:bg-panel hover:text-ink sm:block"
          title="Copy a Claude Code prompt that writes notes on this chapter's highlights"
        >
          ✦ Claude notes
        </button>
        <button
          onClick={props.onToggleSheet}
          className="shrink-0 whitespace-nowrap rounded px-2 py-1 hover:bg-panel"
        >
          Notes{noteCount > 0 && ` (${noteCount})`}
        </button>
      </div>
    </div>
  );
}
