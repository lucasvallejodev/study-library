'use client';

import type { Annotation } from '@study/core';

import { type CardControls, OrphanedAnnotationCard } from './reader-annotation-card';

type OrphanedNotesProps = {
  controls: CardControls;
  orphans: Annotation[];
};

const ORPHANED_EXPLANATION = 'The text changed and these passages could not be found.';

export function OrphanedNotesSection({ controls, orphans }: OrphanedNotesProps) {
  if (orphans.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Orphaned notes ({orphans.length})
      </h2>
      <p className="mb-3 text-xs text-muted">{ORPHANED_EXPLANATION}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {orphans.map(annotation => (
          <OrphanedAnnotationCard key={annotation.id} annotation={annotation} controls={controls} />
        ))}
      </div>
    </section>
  );
}

export function OrphanedNotesList({ controls, orphans }: OrphanedNotesProps) {
  if (orphans.length === 0) return null;

  return (
    <div className="pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Orphaned ({orphans.length})
      </h3>
      <p className="mb-2 text-xs text-muted">{ORPHANED_EXPLANATION}</p>
      {orphans.map(annotation => (
        <OrphanedAnnotationCard key={annotation.id} annotation={annotation} controls={controls} />
      ))}
    </div>
  );
}
