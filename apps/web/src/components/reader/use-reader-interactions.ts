'use client';

import { useCallback } from 'react';

import { cardElementId, type ChapterLink, type ElementRef, isNarrowViewport } from './reader-types';
import { useArticleClick } from './use-article-click';
import { useChapterKeyboard } from './use-chapter-keyboard';
import { useDeepLink } from './use-deep-link';
import type { ReaderAnnotations } from './use-reader-annotations';
import type { ReaderPanels } from './use-reader-panels';

type ReaderInteractionsOptions = {
  annotations: ReaderAnnotations;
  articleRef: ElementRef<HTMLElement>;
  closePopover: () => void;
  docId: string;
  initialPosition: number;
  next: ChapterLink | null;
  panels: ReaderPanels;
  prev: ChapterLink | null;
};

export type ReaderInteractions = {
  onArticleClick: (event: React.MouseEvent) => void;
  startNote: (annotationId: string) => void;
};

export function useReaderInteractions(options: ReaderInteractionsOptions): ReaderInteractions {
  const { annotations, articleRef, closePopover, docId, initialPosition, next, panels, prev } =
    options;

  const { anchored, editingId, focus, ordered, ranges, setEditingId } = annotations;
  const { closeAll, openSheet } = panels;
  const { pulseAnnotation, selectAnnotation, setActiveId } = focus;

  const revealUnplacedCard = useCallback(
    (annotationId: string) => {
      setActiveId(annotationId);
      openSheet();
      document.getElementById(cardElementId(annotationId))?.scrollIntoView({ block: 'center' });
    },
    [openSheet, setActiveId]
  );

  const closeEverything = useCallback(() => {
    closeAll();
    closePopover();
  }, [closeAll, closePopover]);

  useDeepLink({
    anchored,
    articleRef,
    initialPosition,
    onUnplacedLink: revealUnplacedCard,
    pulseAnnotation,
    ranges,
  });

  useChapterKeyboard({
    docId,
    next,
    onEscape: closeEverything,
    prev,
  });

  const onArticleClick = useArticleClick({
    clearSelection: () => {
      if (!editingId) setActiveId(undefined);
    },
    onMarkClick: selectAnnotation,
    onPaintedTextClick: annotationId => {
      selectAnnotation(annotationId);
      if (isNarrowViewport()) openSheet();
    },
    ordered,
    ranges,
  });

  function startNote(annotationId: string) {
    setActiveId(annotationId);
    setEditingId(annotationId);
    if (isNarrowViewport()) openSheet();
  }

  return { onArticleClick, startNote };
}
