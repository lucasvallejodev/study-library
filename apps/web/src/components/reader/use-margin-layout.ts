'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Annotation } from '@study/core';

import type { ElementRef, RangeMap } from './reader-types';

const CARD_GAP = 8;
const ESTIMATED_CARD_HEIGHT = 96;

type CardTops = Record<string, number>;

type MeasuredCard = {
  height: number;
  id: string;
  want: number;
};

type LayoutState = {
  positionedBefore: ReadonlySet<string>;
  tops: CardTops;
};

type MarginLayoutOptions = {
  articleRef: ElementRef<HTMLElement>;
  items: Annotation[];
  pinnedId?: string;
  ranges: RangeMap;
};

export type MarginLayout = {
  animatesMoves: (id: string) => boolean;
  marginRef: ElementRef<HTMLDivElement>;
  registerCard: (id: string) => (element: HTMLDivElement | null) => void;
  tops: CardTops;
};

function isHiddenBelowWideLayout(margin: HTMLElement): boolean {
  return margin.offsetParent === null;
}

function pruneRemovedCards(cards: Map<string, HTMLDivElement>, items: Annotation[]) {
  for (const id of cards.keys()) {
    if (!items.some(annotation => annotation.id === id)) cards.delete(id);
  }
}

function measureCards(
  margin: HTMLElement,
  items: Annotation[],
  cards: Map<string, HTMLDivElement>,
  ranges: RangeMap
): MeasuredCard[] {
  const origin = margin.getBoundingClientRect().top;

  return items.map(annotation => ({
    height: cards.get(annotation.id)?.offsetHeight ?? ESTIMATED_CARD_HEIGHT,
    id: annotation.id,
    want: ranges.get(annotation.id)!.getBoundingClientRect().top - origin,
  }));
}

function stackAroundPinnedCard(cards: MeasuredCard[], pinnedId?: string): CardTops {
  const positions = new Array<number>(cards.length);

  const pinned = Math.max(
    0,
    cards.findIndex(card => card.id === pinnedId)
  );

  positions[pinned] = cards[pinned] ? Math.max(0, cards[pinned].want) : 0;

  for (let index = pinned + 1; index < cards.length; index++) {
    const above = positions[index - 1] + cards[index - 1].height + CARD_GAP;

    positions[index] = Math.max(cards[index].want, above);
  }

  for (let index = pinned - 1; index >= 0; index--) {
    const below = positions[index + 1] - cards[index].height - CARD_GAP;

    positions[index] = Math.min(cards[index].want, below);
  }

  return Object.fromEntries(cards.map((card, index) => [card.id, positions[index]]));
}

function sameTops(left: CardTops, right: CardTops): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nextLayout(previous: LayoutState, tops: CardTops): LayoutState {
  if (sameTops(previous.tops, tops)) return previous;

  return {
    positionedBefore: new Set([...previous.positionedBefore, ...Object.keys(previous.tops)]),
    tops,
  };
}

function useRelayoutOnResize(articleRef: ElementRef<HTMLElement>, relayout: () => void) {
  useEffect(() => {
    const observer = new ResizeObserver(relayout);

    if (articleRef.current) observer.observe(articleRef.current);
    window.addEventListener('resize', relayout);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', relayout);
    };
  }, [articleRef, relayout]);
}

export function useMarginLayout(options: MarginLayoutOptions): MarginLayout {
  const { articleRef, items, pinnedId, ranges } = options;
  const marginRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [layout, setLayout] = useState<LayoutState>({ positionedBefore: new Set(), tops: {} });
  const [layoutPass, setLayoutPass] = useState(0);
  const relayout = useCallback(() => setLayoutPass(pass => pass + 1), []);

  useRelayoutOnResize(articleRef, relayout);

  useLayoutEffect(() => {
    const margin = marginRef.current;

    if (!margin || isHiddenBelowWideLayout(margin)) return;
    pruneRemovedCards(cardRefs.current, items);

    const tops = stackAroundPinnedCard(
      measureCards(margin, items, cardRefs.current, ranges),
      pinnedId
    );

    setLayout(previous => nextLayout(previous, tops));
  }, [items, layoutPass, pinnedId, ranges]);

  const registerCard = useCallback(
    (id: string) => (element: HTMLDivElement | null) => {
      if (!element) return;
      const firstRegistration = !cardRefs.current.has(id);

      cardRefs.current.set(id, element);
      if (firstRegistration) requestAnimationFrame(relayout);
    },
    [relayout]
  );

  const animatesMoves = (id: string) => layout.positionedBefore.has(id);

  return {
    animatesMoves,
    marginRef,
    registerCard,
    tops: layout.tops,
  };
}
