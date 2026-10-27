'use client';

import { describeRange, textOf } from '@study/anchoring';
import type { Annotation, HighlightColor } from '@study/core';

import { annotationPath, copyText, HighlightColors, studyPrompt } from '../annotations';
import { AnnotationApi } from './api';
import type { ElementRef } from './reader-types';
import type { SelectionPopoverState } from './use-selection-popover';
import type { Notify } from './use-toast';

type SelectionPopoverProps = {
  articleRef: ElementRef<HTMLElement>;
  chapterId: string;
  closePopover: () => void;
  docId: string;
  notify: Notify;
  onCreated: (annotation: Annotation) => void;
  onNoteStarted: (annotationId: string) => void;
  popover: SelectionPopoverState;
};

type HighlightOptions = {
  color?: HighlightColor;
  withNote?: boolean;
};

const ACTION_CLASS = 'rounded px-2 py-1 hover:bg-panel';

export function SelectionPopover(props: SelectionPopoverProps) {
  const { articleRef, chapterId, closePopover, docId, notify, popover } = props;

  async function highlight(options: HighlightOptions): Promise<Annotation | undefined> {
    const root = articleRef.current;

    if (!root) return;
    const selectors = describeRange(textOf(root), popover.start, popover.end);

    try {
      const created = await AnnotationApi.create({
        chapterId,
        color: options.color ?? 'yellow',
        documentId: docId,
        selectors,
        type: 'highlight',
      });

      props.onCreated(created);
      window.getSelection()?.removeAllRanges();
      closePopover();
      if (options.withNote) props.onNoteStarted(created.id);

      return created;
    } catch (error) {
      notify((error as Error).message);
    }
  }

  async function copyLink() {
    const created = await highlight({});

    if (!created) return;
    await copyText(location.origin + annotationPath(docId, chapterId, created.id));
    history.replaceState(null, '', `#${created.id}`);
    notify('Link copied');
  }

  async function askClaude() {
    const created = await highlight({ color: 'blue' });

    if (!created) return;
    await copyText(studyPrompt(docId, chapterId, created.id));
    notify('Prompt copied — paste it into Claude Code');
  }

  return (
    <div
      className="absolute z-40 flex items-center gap-1 rounded-lg border border-line bg-panel p-1.5 font-sans text-sm shadow-xl ring-1 ring-black/5"
      style={{ left: popover.left, top: popover.top }}
      onMouseUp={event => event.stopPropagation()}
      onMouseDown={event => event.preventDefault()}
    >
      {HighlightColors.map(color => (
        <button
          key={color}
          onClick={() => highlight({ color })}
          className={`swatch-${color} size-6 rounded-full ring-1 ring-black/10 hover:scale-110`}
          title={`Highlight ${color}`}
        />
      ))}
      <span className="mx-1 h-5 w-px bg-line" />
      <button onClick={() => highlight({ withNote: true })} className={ACTION_CLASS}>
        Note
      </button>
      <button onClick={copyLink} className={ACTION_CLASS}>
        Link
      </button>
      <button
        onClick={askClaude}
        className={ACTION_CLASS}
        title="Highlight and copy a /study prompt for Claude Code"
      >
        Ask Claude
      </button>
    </div>
  );
}
