'use client';

import { useLayoutEffect, useState } from 'react';

import { lastLineOf } from './passages';
import type { ElementRef } from './reader-types';
import { useLayoutTick } from './use-layout-tick';

const BUBBLE_MAX_WIDTH = 600;
const GAP_BELOW_PASSAGE = 10;
const CARET_INSET = 24;
const LEFT_OVERHANG = 32;

export type BubblePosition = {
  caretLeft: number;
  left: number;
  top: number;
  width: number;
};

type BubblePositionOptions = {
  articleRef: ElementRef<HTMLElement>;
  range?: Range;
  wrapperRef: ElementRef<HTMLDivElement>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function measureBubble(range: Range, article: HTMLElement, wrapper: HTMLElement) {
  const line = lastLineOf(range);

  if (!line) return undefined;
  const origin = wrapper.getBoundingClientRect();
  const column = article.getBoundingClientRect();
  const width = Math.min(BUBBLE_MAX_WIDTH, column.width);
  const columnLeft = column.left - origin.left;
  const lineLeft = line.left - origin.left;
  const left = clamp(lineLeft - LEFT_OVERHANG, columnLeft, columnLeft + column.width - width);

  return {
    caretLeft: clamp(lineLeft - left + CARET_INSET, CARET_INSET, width - CARET_INSET),
    left,
    top: line.bottom - origin.top + GAP_BELOW_PASSAGE,
    width,
  };
}

export function useBubblePosition(options: BubblePositionOptions): BubblePosition | undefined {
  const { articleRef, range, wrapperRef } = options;
  const tick = useLayoutTick(articleRef);
  const [position, setPosition] = useState<BubblePosition>();

  useLayoutEffect(() => {
    const article = articleRef.current;
    const wrapper = wrapperRef.current;

    setPosition(range && article && wrapper ? measureBubble(range, article, wrapper) : undefined);
  }, [articleRef, range, tick, wrapperRef]);

  return position;
}
