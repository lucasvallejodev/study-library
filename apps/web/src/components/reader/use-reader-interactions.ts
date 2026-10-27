'use client';

import { useCallback } from 'react';

import { cardElementId, type ChapterLink, type ElementRef } from './reader-types';
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

  const { anchored, closeBubble, editingId, focus, openBubble, ordered, ranges, setEditingId } =
    annotations;

  const { closeAll, openSheet } = panels;
  const { pulseAnnotation, setActiveId } = focus;

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
    closeBubble();
  }, [closeAll, closePopover, closeBubble]);

  const showLinkedPassage = useCallback(
    (annotationId: string) => {
      pulseAnnotation(annotationId);
      openBubble(annotationId);
    },
    [openBubble, pulseAnnotation]
  );

  useDeepLink({
    anchored,
    articleRef,
    initialPosition,
    onUnplacedLink: revealUnplacedCard,
    pulseAnnotation: showLinkedPassage,
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
      if (editingId) return;
      setActiveId(undefined);
      closeBubble();
    },
    onMarkClick: openBubble,
    onPaintedTextClick: openBubble,
    ordered,
    ranges,
  });

  function startNote(annotationId: string) {
    setEditingId(annotationId);
    openBubble(annotationId);
  }

  return { onArticleClick, startNote };
}
