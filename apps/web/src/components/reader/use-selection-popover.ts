'use client';

import { useCallback, useEffect, useState } from 'react';

import { offsetsFromRange, textOf } from '@study/anchoring';

import { isWhitespace } from '../patterns';
import type { ElementRef } from './reader-types';

const SELECTION_SETTLE_MS = 10;
const VIEWPORT_MARGIN = 8;
const POPOVER_RIGHT_RESERVE = 320;
const POPOVER_HALF_WIDTH = 150;
const POPOVER_GAP = 8;
const HALVES = 2;
const SelectionEndEvents = ['mouseup', 'touchend', 'keyup'] as const;

export type SelectionPopoverState = {
  end: number;
  left: number;
  start: number;
  top: number;
};

type TextSpan = {
  end: number;
  start: number;
};

type Origin = {
  left: number;
  top: number;
};

function trimWhitespace(text: string, span: TextSpan): TextSpan {
  let { end, start } = span;

  while (start < end && isWhitespace(text[start])) start++;
  while (end > start && isWhitespace(text[end - 1])) end--;

  return { end, start };
}

function popoverPlacement(rect: DOMRect, origin: Origin): Origin {
  const centered = rect.left + rect.width / HALVES - POPOVER_HALF_WIDTH;
  const maxLeft = window.innerWidth - POPOVER_RIGHT_RESERVE;

  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(maxLeft, centered)) - origin.left,
    top: rect.bottom - origin.top + POPOVER_GAP,
  };
}

function selectedRange(): Range | undefined {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return undefined;

  return selection.getRangeAt(0);
}

function readSelection(
  root: HTMLElement,
  wrapper: HTMLElement | null
): SelectionPopoverState | null {
  const range = selectedRange();
  const offsets = range && offsetsFromRange(root, range);

  if (!range || !offsets) return null;
  const span = trimWhitespace(textOf(root), offsets);

  if (span.end <= span.start) return null;
  const origin = wrapper?.getBoundingClientRect() ?? { left: 0, top: 0 };

  return { ...span, ...popoverPlacement(range.getBoundingClientRect(), origin) };
}

export function useSelectionPopover(
  articleRef: ElementRef<HTMLElement>,
  wrapperRef: ElementRef<HTMLDivElement>
): { closePopover: () => void; popover: SelectionPopoverState | null } {
  const [popover, setPopover] = useState<SelectionPopoverState | null>(null);

  useEffect(() => {
    const onSelectionEnd = () =>
      setTimeout(() => {
        const root = articleRef.current;

        setPopover(root ? readSelection(root, wrapperRef.current) : null);
      }, SELECTION_SETTLE_MS);

    for (const type of SelectionEndEvents) document.addEventListener(type, onSelectionEnd);

    return () => {
      for (const type of SelectionEndEvents) document.removeEventListener(type, onSelectionEnd);
    };
  }, [articleRef, wrapperRef]);

  const closePopover = useCallback(() => setPopover(null), []);

  return { closePopover, popover };
}
