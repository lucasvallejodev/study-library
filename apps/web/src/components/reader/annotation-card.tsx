'use client';

import { useEffect, useRef, useState } from 'react';

import type { Annotation, HighlightColor } from '@study/core';

import { copyText, HighlightColors, quoteOf, tagHref } from '../annotations';
import { AnnotationApi } from './api';
import { cardElementId } from './reader-types';

const CLAUDE_TAG = 'claude';
const EDITOR_ROWS = 4;
const FocusWithoutScrolling = { preventScroll: true };

type Props = {
  active: boolean;
  annotation: Annotation;
  compact?: boolean;
  editing: boolean;
  link: string;
  notify: (message: string) => void;
  onChange: (annotation: Annotation) => void;
  onDelete: () => void;
  onEdit: (editing: boolean) => void;
  onFocus?: () => void;
  studyPrompt: string;
};

type Draft = {
  body: string;
  tags: string;
};

type DraftSource = Pick<Annotation, 'body' | 'tags'>;

function draftOf(annotation: DraftSource): Draft {
  return { body: annotation.body ?? '', tags: annotation.tags.join(', ') };
}

function parseTags(tags: string): string[] {
  return tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function isByClaude(annotation: Annotation): boolean {
  return annotation.tags.includes(CLAUDE_TAG);
}

function swatchOf(annotation: Annotation): string {
  if (annotation.type === 'ai_question') return 'question';
  if (isByClaude(annotation) && !annotation.color) return 'claude';

  return annotation.color ?? 'yellow';
}

function visibleTagsOf(annotation: Annotation): string[] {
  return isByClaude(annotation)
    ? annotation.tags.filter(tag => tag !== CLAUDE_TAG)
    : annotation.tags;
}

function cardClass(active: boolean, compact?: boolean): string {
  const state = active ? 'border-accent bg-panel shadow-md' : 'border-line bg-paper';
  const shift = compact && active ? '-translate-x-2' : '';

  return `rounded-lg border p-3 text-sm transition ${state} ${shift}`;
}

function useDraftSyncedWith(annotation: DraftSource) {
  const [draft, setDraft] = useState(() => draftOf(annotation));
  const [syncedFrom, setSyncedFrom] = useState<DraftSource>(annotation);

  if (syncedFrom.body !== annotation.body || syncedFrom.tags !== annotation.tags) {
    setSyncedFrom(annotation);
    setDraft(draftOf(annotation));
  }

  return [draft, setDraft] as const;
}

export function AnnotationCard(props: Props) {
  const { active, annotation, compact, editing, onChange, onEdit } = props;
  const [draft, setDraft] = useDraftSyncedWith(annotation);
  const quote = quoteOf(annotation);

  async function save() {
    const updated = await AnnotationApi.update(annotation.id, {
      body: draft.body.trim() || null,
      tags: parseTags(draft.tags),
    });

    onChange(updated);
    onEdit(false);
  }

  return (
    <div id={cardElementId(annotation.id)} className={cardClass(active, compact)}>
      <CardLabel annotation={annotation} />
      {quote && (
        <CardQuote
          quote={quote}
          swatch={swatchOf(annotation)}
          compact={compact}
          onFocus={props.onFocus}
        />
      )}
      {editing ? (
        <NoteEditor
          draft={draft}
          onDraftChange={setDraft}
          onSave={save}
          onCancel={() => onEdit(false)}
        />
      ) : (
        <>
          <NoteBody annotation={annotation} />
          <CardActions {...props} hasQuote={Boolean(quote)} />
        </>
      )}
    </div>
  );
}

function CardLabel({ annotation }: { annotation: Annotation }) {
  if (annotation.type !== 'ai_question' && !isByClaude(annotation)) return null;

  return (
    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {annotation.type === 'ai_question' ? 'Claude asked' : 'Claude’s note'}
    </div>
  );
}

type CardQuoteProps = {
  compact?: boolean;
  onFocus?: () => void;
  quote: string;
  swatch: string;
};

function CardQuote({ compact, onFocus, quote, swatch }: CardQuoteProps) {
  const clamp = compact ? 'line-clamp-1 text-muted' : 'line-clamp-4';

  return (
    <button onClick={onFocus} className="flex w-full gap-2 text-left">
      <span className={`swatch-${swatch} mt-1 w-1 shrink-0 self-stretch rounded-full`} />
      <span className={`${clamp} font-serif text-[0.95rem] leading-snug`}>{quote}</span>
    </button>
  );
}

type NoteEditorProps = {
  draft: Draft;
  onCancel: () => void;
  onDraftChange: (draft: Draft) => void;
  onSave: () => Promise<void>;
};

function useFocusedWithoutScrolling() {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    editorRef.current?.focus(FocusWithoutScrolling);
  }, []);

  return editorRef;
}

function isSaveShortcut(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

function NoteEditor({ draft, onCancel, onDraftChange, onSave }: NoteEditorProps) {
  const editorRef = useFocusedWithoutScrolling();

  function onKeyDown(event: React.KeyboardEvent) {
    if (isSaveShortcut(event)) void onSave();
    if (event.key === 'Escape') onCancel();
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        ref={editorRef}
        value={draft.body}
        onChange={event => onDraftChange({ ...draft, body: event.target.value })}
        onKeyDown={onKeyDown}
        rows={EDITOR_ROWS}
        placeholder="Write a note (Markdown)… ⌘↵ to save"
        className="w-full rounded border border-line bg-paper p-2 outline-none focus:border-accent"
      />
      <input
        value={draft.tags}
        onChange={event => onDraftChange({ ...draft, tags: event.target.value })}
        placeholder="tags, comma separated"
        className="w-full rounded border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button onClick={onSave} className="rounded bg-accent px-3 py-1 text-white">
          Save
        </button>
        <button onClick={onCancel} className="rounded px-3 py-1 text-muted hover:bg-panel">
          Cancel
        </button>
      </div>
    </div>
  );
}

function NoteBody({ annotation }: { annotation: Annotation }) {
  const visibleTags = visibleTagsOf(annotation);

  return (
    <>
      {annotation.body && <p className="mt-2 whitespace-pre-wrap">{annotation.body}</p>}
      {visibleTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleTags.map(tag => (
            <a
              key={tag}
              href={tagHref(tag)}
              className="rounded-full bg-panel px-2 text-xs text-muted"
            >
              #{tag}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

type CardActionsProps = Props & { hasQuote: boolean };

function CardActions({
  annotation,
  hasQuote,
  link,
  notify,
  onChange,
  onDelete,
  onEdit,
  studyPrompt,
}: CardActionsProps) {
  async function recolor(color: HighlightColor) {
    onChange(await AnnotationApi.update(annotation.id, { color }));
  }

  async function copyLink() {
    await copyText(location.origin + link);
    notify('Link copied');
  }

  async function copyStudyPrompt() {
    await copyText(studyPrompt);
    notify('Prompt copied — paste it into Claude Code');
  }

  async function remove() {
    if (!confirm('Delete this annotation?')) return;
    await AnnotationApi.remove(annotation.id);
    onDelete();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
      {hasQuote && annotation.type === 'highlight' && (
        <ColorPicker current={annotation.color} onPick={recolor} />
      )}
      <button onClick={() => onEdit(true)} className="hover:text-ink">
        {annotation.body ? 'Edit' : 'Add note'}
      </button>
      <button onClick={copyLink} className="hover:text-ink">
        Link
      </button>
      <button onClick={copyStudyPrompt} className="hover:text-ink">
        Ask Claude
      </button>
      <button onClick={remove} className="ml-auto hover:text-red-600">
        Delete
      </button>
    </div>
  );
}

type ColorPickerProps = {
  current: Annotation['color'];
  onPick: (color: HighlightColor) => Promise<void>;
};

function ColorPicker({ current, onPick }: ColorPickerProps) {
  return HighlightColors.map(color => (
    <button
      key={color}
      onClick={() => onPick(color)}
      className={`swatch-${color} size-3 rounded-full ${current === color ? 'ring-2 ring-ink/40' : ''}`}
      title={color}
    />
  ));
}
