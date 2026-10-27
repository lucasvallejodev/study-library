'use client';

import { useState } from 'react';

import type { Annotation } from '@study/core';

import { studyPrompt } from '../annotations';
import { AnnotationCard } from './annotation-card';
import { AnnotationApi } from './api';

const DRAFT_ROWS = 3;

type Props = {
  chapterId: string;
  documentId: string;
  link: (id: string) => string;
  notes: Annotation[];
  notify: (message: string) => void;
  onChange: (annotation: Annotation) => void;
  onCreate: (annotation: Annotation) => void;
  onDelete: (id: string) => void;
};

function isSaveShortcut(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

export function ChapterNotes(props: Props) {
  const { chapterId, documentId, notes, onCreate } = props;
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string>();

  async function add() {
    if (!draft.trim()) return;

    onCreate(
      await AnnotationApi.create({
        body: draft.trim(),
        chapterId,
        documentId,
        type: 'note',
      })
    );
    setDraft('');
  }

  return (
    <section className="mt-16 border-t border-line pt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Chapter notes
      </h2>
      <div className="space-y-3">
        {notes.map(note => (
          <ChapterNoteCard
            key={note.id}
            {...props}
            note={note}
            editing={editingId === note.id}
            onEdit={editing => setEditingId(editing ? note.id : undefined)}
          />
        ))}
      </div>
      <textarea
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => isSaveShortcut(event) && void add()}
        rows={DRAFT_ROWS}
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

type ChapterNoteCardProps = Props & {
  editing: boolean;
  note: Annotation;
  onEdit: (editing: boolean) => void;
};

function ChapterNoteCard(props: ChapterNoteCardProps) {
  const { chapterId, documentId, editing, link, note, notify, onChange, onDelete, onEdit } = props;

  return (
    <AnnotationCard
      annotation={note}
      active={false}
      editing={editing}
      onEdit={onEdit}
      onChange={onChange}
      onDelete={() => onDelete(note.id)}
      link={link(note.id)}
      studyPrompt={studyPrompt(documentId, chapterId, note.id)}
      notify={notify}
    />
  );
}
