'use client';

import { useCallback } from 'react';

import type { Annotation } from '@study/core';

import { supportsHighlights } from './paint';
import type { RangeMap } from './reader-types';

type CaretDocument = Document & {
  caretPositionFromPoint?: (
    clientX: number,
    clientY: number
  ) => { offset: number; offsetNode: Node } | null;
};

type Caret = {
  node: Node;
  offset: number;
};

type ArticleClickOptions = {
  clearSelection: () => void;
  onMarkClick: (annotationId: string) => void;
  onPaintedTextClick: (annotationId: string) => void;
  ordered: Annotation[];
  ranges: RangeMap;
};

function caretAt(clientX: number, clientY: number): Caret | undefined {
  const position = (document as CaretDocument).caretPositionFromPoint?.(clientX, clientY);

  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = document.caretRangeFromPoint?.(clientX, clientY);

  return range ? { node: range.startContainer, offset: range.startOffset } : undefined;
}

function containsCaret(range: Range, caret: Caret): boolean {
  try {
    return range.isPointInRange(caret.node, caret.offset);
  } catch {
    return false;
  }
}

function annotationAtCaret(ordered: Annotation[], ranges: RangeMap, caret: Caret) {
  return ordered.find(annotation => containsCaret(ranges.get(annotation.id)!, caret));
}

function markedAnnotationId(target: HTMLElement): string | null | undefined {
  return target.closest('mark[data-annotation]')?.getAttribute('data-annotation');
}

function isPlainClick(target: HTMLElement): boolean {
  return Boolean(window.getSelection()?.isCollapsed) && !target.closest('a');
}

export function useArticleClick(options: ArticleClickOptions): (event: React.MouseEvent) => void {
  const { clearSelection, onMarkClick, onPaintedTextClick, ordered, ranges } = options;

  return useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;

      if (!isPlainClick(target)) return;

      if (!supportsHighlights()) {
        const markedId = markedAnnotationId(target);

        if (markedId) onMarkClick(markedId);

        return;
      }

      const caret = caretAt(event.clientX, event.clientY);

      if (!caret) return;
      const hit = annotationAtCaret(ordered, ranges, caret);

      if (hit) onPaintedTextClick(hit.id);
      else clearSelection();
    },
    [clearSelection, onMarkClick, onPaintedTextClick, ordered, ranges]
  );
}
