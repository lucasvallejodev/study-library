'use client';

import { useState } from 'react';

import type { Annotation } from '@study/core';

import { AnnotationCard } from './AnnotationCard';
import { api } from './api';

type Props = {
  chapterId: string;
  documentId: string;
  link: (id: string) => string;
  notes: Annotation[];
  notify: (m: string) => void;
  onChange: (a: Annotation) => void;
  onCreate: (a: Annotation) => void;
  onDelete: (id: string) => void;
};

/** Notes about the whole chapter, shown below the text. */
export function ChapterNotes({
  chapterId,
  documentId,
  link,
  notes,
  notify,
  onChange,
  onCreate,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string>();

  async function add() {
    if (!draft.trim()) return;
    onCreate(
      await api.create({
        body: draft.trim(),
        chapterId,
        documentId,
        type: 'note',
      })
    );
    setDraft('');
  }

  return (
    <section className="mx-auto mt-16 max-w-[680px] border-t border-line pt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Chapter notes
      </h2>
      <div className="space-y-3">
        {notes.map(n => (
          <AnnotationCard
            key={n.id}
            annotation={n}
            active={false}
            editing={editingId === n.id}
            onEdit={v => setEditingId(v ? n.id : undefined)}
            onFocus={() => {}}
            onChange={onChange}
            onDelete={() => onDelete(n.id)}
            link={link(n.id)}
            studyPrompt={`/study ${documentId} ${chapterId} --focus ${n.id}`}
            notify={notify}
          />
        ))}
      </div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && void add()}
        rows={3}
        placeholder="Summarise the chapter, note open questions… (Markdown, ⌘↵ to save)"
        className="mt-3 w-full rounded-lg border border-line bg-panel p-3 text-sm outline-none focus:border-accent"
      />
      <button
        onClick={add}
        disabled={!draft.trim()}
        className="mt-2 rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        Add chapter note
      </button>
    </section>
  );
}
