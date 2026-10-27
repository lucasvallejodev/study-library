'use client';

import { useEffect, useRef } from 'react';

import type { Annotation } from '@study/core';

import { annotationsAtPassage } from './passages';
import { type CardControls, PlacedAnnotationCard } from './reader-annotation-card';
import type { ElementRef, RangeMap } from './reader-types';
import { type BubblePosition, useBubblePosition } from './use-bubble-position';

type NoteBubbleProps = {
  annotationId?: string;
  articleRef: ElementRef<HTMLElement>;
  controls: CardControls;
  onClose: () => void;
  ordered: Annotation[];
  ranges: RangeMap;
  wrapperRef: ElementRef<HTMLDivElement>;
};

const STICKY_HEADERS_HEIGHT = 100;
const VIEWPORT_MARGIN = 16;

function bubbleStyle(position: BubblePosition): React.CSSProperties {
  return {
    left: position.left,
    top: position.top,
    width: position.width,
  };
}

function scrollNeededToShow(passageTop: number, bubbleBottom: number): number {
  const visibleTop = STICKY_HEADERS_HEIGHT + VIEWPORT_MARGIN;
  const overflowBelow = bubbleBottom - (window.innerHeight - VIEWPORT_MARGIN);
  const roomAbove = passageTop - visibleTop;

  if (roomAbove < 0) return roomAbove;
  if (overflowBelow > 0) return Math.min(overflowBelow, roomAbove);

  return 0;
}

function useKeptInView(range: Range | undefined, ready: boolean) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bubble = bubbleRef.current;

    if (!ready || !range || !bubble) return;

    const scrollBy = scrollNeededToShow(
      range.getBoundingClientRect().top,
      bubble.getBoundingClientRect().bottom
    );

    if (scrollBy) window.scrollBy({ behavior: 'smooth', top: scrollBy });
  }, [range, ready]);

  return bubbleRef;
}

export function NoteBubble(props: NoteBubbleProps) {
  const { annotationId, articleRef, controls, onClose, ordered, ranges, wrapperRef } = props;
  const range = annotationId ? ranges.get(annotationId) : undefined;

  const position = useBubblePosition({
    articleRef,
    range,
    wrapperRef,
  });

  const bubbleRef = useKeptInView(range, Boolean(position));
  const passage = annotationId ? annotationsAtPassage(annotationId, ordered, ranges) : [];

  if (!position || passage.length === 0) return null;

  return (
    <div
      ref={bubbleRef}
      role="dialog"
      aria-label="Notes on this passage"
      className="absolute z-10 rounded-xl border border-line bg-panel px-5 py-2 font-sans shadow-2xl"
      style={bubbleStyle(position)}
      onMouseUp={event => event.stopPropagation()}
    >
      <BubbleCaret left={position.caretLeft} />
      <button
        onClick={onClose}
        aria-label="Close notes"
        className="absolute right-3 top-3 rounded px-1.5 text-muted hover:bg-panel hover:text-ink"
      >
        ✕
      </button>
      <div className="divide-y divide-line">
        {passage.map(annotation => (
          <PlacedAnnotationCard
            key={annotation.id}
            annotation={annotation}
            controls={controls}
            variant="bubble"
          />
        ))}
      </div>
    </div>
  );
}

function BubbleCaret({ left }: { left: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 size-3 rotate-45 border-l border-t border-line bg-panel"
      style={{ left }}
    />
  );
}
