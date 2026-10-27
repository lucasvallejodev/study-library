'use client';

import type { Annotation } from '@study/core';

import { OrphanedNotesList } from './orphaned-notes';
import { type CardControls, PlacedAnnotationCard } from './reader-annotation-card';

type NotesSheetProps = {
  controls: CardControls;
  onClose: () => void;
  open: boolean;
  ordered: Annotation[];
  orphans: Annotation[];
};

export function NotesSheet({ controls, onClose, open, ordered, orphans }: NotesSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 xl:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-line bg-paper p-4 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            In this chapter
          </h2>
          <button onClick={onClose} className="text-sm text-muted">
            Close
          </button>
        </div>
        <div className="space-y-3">
          {ordered.length === 0 && orphans.length === 0 && (
            <p className="text-sm text-muted">Select text to highlight it or add a note.</p>
          )}
          {ordered.map(annotation => (
            <PlacedAnnotationCard key={annotation.id} annotation={annotation} controls={controls} />
          ))}
          <OrphanedNotesList controls={controls} orphans={orphans} />
        </div>
      </div>
    </div>
  );
}
