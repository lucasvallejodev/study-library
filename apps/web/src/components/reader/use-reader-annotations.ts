'use client';

import { useState } from 'react';

import type { Annotation } from '@study/core';

import type { CardControls } from './reader-annotation-card';
import type { ElementRef, RangeMap } from './reader-types';
import { type AnchoredAnnotations, useAnchoredAnnotations } from './use-anchored-annotations';
import { type AnnotationFocus, useAnnotationFocus } from './use-annotation-focus';
import { type AnnotationList, useAnnotationList } from './use-annotation-list';
import { usePaintedHighlights } from './use-painted-highlights';
import type { Notify } from './use-toast';

type ReaderAnnotationsOptions = {
  articleRef: ElementRef<HTMLElement>;
  chapterId: string;
  docId: string;
  initialAnnotations: Annotation[];
  notify: Notify;
};

export type ReaderAnnotations = AnchoredAnnotations & {
  chapterNotes: Annotation[];
  controls: CardControls;
  editingId?: string;
  focus: AnnotationFocus;
  list: AnnotationList;
  orphans: Annotation[];
  setEditingId: (id: string | undefined) => void;
  setHoverId: (id: string | undefined) => void;
};

function orphansOf(annotations: Annotation[], ranges: RangeMap): Annotation[] {
  return annotations.filter(
    annotation => annotation.selectors.length > 0 && !ranges.has(annotation.id)
  );
}

function chapterNotesOf(annotations: Annotation[]): Annotation[] {
  return annotations.filter(
    annotation => annotation.selectors.length === 0 && annotation.type !== 'bookmark'
  );
}

export function useReaderAnnotations(options: ReaderAnnotationsOptions): ReaderAnnotations {
  const { articleRef, chapterId, docId, initialAnnotations, notify } = options;
  const list = useAnnotationList(initialAnnotations);
  const anchoring = useAnchoredAnnotations(articleRef, list.annotations);
  const focus = useAnnotationFocus(anchoring.ranges);
  const [editingId, setEditingId] = useState<string>();
  const [hoverId, setHoverId] = useState<string>();

  usePaintedHighlights(list.annotations, anchoring.ranges, hoverId ?? focus.activeId);

  const controls: CardControls = {
    activeId: focus.activeId,
    chapterId,
    clearActive: () => focus.setActiveId(undefined),
    docId,
    editingId,
    notify,
    pulseAnnotation: focus.pulseAnnotation,
    remove: list.remove,
    replace: list.replace,
    setActiveId: focus.setActiveId,
    setEditingId,
  };

  return {
    ...anchoring,
    chapterNotes: chapterNotesOf(list.annotations),
    controls,
    editingId,
    focus,
    list,
    orphans: orphansOf(list.annotations, anchoring.ranges),
    setEditingId,
    setHoverId,
  };
}
