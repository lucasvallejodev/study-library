'use client';

import type { Annotation } from '@study/core';

import { copyText } from '../annotations';
import { useStoredPreference } from '../use-stored-preference';
import { type CardControls, PlacedAnnotationCard } from './reader-annotation-card';
import type { ElementRef, RangeMap } from './reader-types';
import { useMarginLayout } from './use-margin-layout';

type MarginMode = 'notes' | 'all';

type MarginNotesProps = {
  articleRef: ElementRef<HTMLElement>;
  controls: CardControls;
  onHover: (annotationId: string | undefined) => void;
  ordered: Annotation[];
  ranges: RangeMap;
};

const MARGIN_MODE_KEY = 'marginMode';
const HEADER_BUTTON_CLASS = 'rounded px-1.5 py-0.5 hover:bg-panel hover:text-ink';
const FillColumn = { minHeight: '100%' };

function useMarginMode(): [MarginMode, () => void] {
  const [stored, saveMode] = useStoredPreference(MARGIN_MODE_KEY);
  const mode: MarginMode = stored === 'all' ? 'all' : 'notes';

  return [mode, () => saveMode(mode === 'all' ? 'notes' : 'all')];
}

function belongsInMargin(
  annotation: Annotation,
  mode: MarginMode,
  controls: CardControls
): boolean {
  return (
    mode === 'all' ||
    Boolean(annotation.body) ||
    annotation.type === 'ai_question' ||
    annotation.id === controls.activeId ||
    annotation.id === controls.editingId
  );
}

export function MarginNotes({ articleRef, controls, onHover, ordered, ranges }: MarginNotesProps) {
  const [mode, toggleMode] = useMarginMode();
  const items = ordered.filter(annotation => belongsInMargin(annotation, mode, controls));
  const pinnedId = controls.editingId ?? controls.activeId;

  const { animatesMoves, marginRef, registerCard, tops } = useMarginLayout({
    articleRef,
    items,
    pinnedId,
    ranges,
  });

  return (
    <aside className="hidden py-10 xl:block">
      <MarginHeader mode={mode} onToggleMode={toggleMode} controls={controls} />
      <div ref={marginRef} className="relative" style={FillColumn}>
        {items.length === 0 && (
          <p className="text-sm text-muted">
            Select text to highlight it, then add a note. Notes appear here, beside their passage.
          </p>
        )}
        {items.map(annotation => (
          <PositionedCard
            key={annotation.id}
            animated={animatesMoves(annotation.id)}
            annotation={annotation}
            cardRef={registerCard(annotation.id)}
            controls={controls}
            onHover={onHover}
            top={tops[annotation.id]}
          />
        ))}
      </div>
    </aside>
  );
}

type MarginHeaderProps = {
  controls: CardControls;
  mode: MarginMode;
  onToggleMode: () => void;
};

function MarginHeader({ controls, mode, onToggleMode }: MarginHeaderProps) {
  async function copyHighlightNotesPrompt() {
    await copyText(`/highlight-notes ${controls.docId} ${controls.chapterId}`);
    controls.notify('Prompt copied — paste it into Claude Code');
  }

  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
      <span className="font-semibold uppercase tracking-wider">Notes</span>
      <button
        onClick={onToggleMode}
        className={`ml-auto ${HEADER_BUTTON_CLASS}`}
        title="Show every highlight in the margin, or only the ones with notes"
      >
        {mode === 'all' ? 'All highlights' : 'With notes'} ▾
      </button>
      <button
        onClick={copyHighlightNotesPrompt}
        className={HEADER_BUTTON_CLASS}
        title="Copy a Claude Code prompt that writes notes on this chapter's highlights"
      >
        ✦ Claude notes
      </button>
    </div>
  );
}

type PositionedCardProps = {
  animated: boolean;
  annotation: Annotation;
  cardRef: (element: HTMLDivElement | null) => void;
  controls: CardControls;
  onHover: (annotationId: string | undefined) => void;
  top?: number;
};

function positionedCardStyle(top: number | undefined): React.CSSProperties {
  return { opacity: top === undefined ? 0 : 1, top: top ?? 0 };
}

function PositionedCard(props: PositionedCardProps) {
  const { animated, annotation, cardRef, controls, onHover, top } = props;
  const transition = animated ? 'transition-[top] duration-200' : '';

  return (
    <div
      ref={cardRef}
      className={`absolute inset-x-0 ${transition}`}
      style={positionedCardStyle(top)}
      onMouseEnter={() => onHover(annotation.id)}
      onMouseLeave={() => onHover(undefined)}
    >
      <PlacedAnnotationCard annotation={annotation} compact controls={controls} />
    </div>
  );
}
