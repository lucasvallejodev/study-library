import type { Annotation } from '@study/core';

import type { RangeMap } from './reader-types';

const AI_TAG = 'ai';

const BubbleOrder: Record<string, number> = {
  ai: 1,
  question: 2,
  yours: 0,
};

export function hasNote(annotation: Annotation): boolean {
  return Boolean(annotation.body) || annotation.type === 'ai_question';
}

function startsBeforeEndOf(range: Range, other: Range): boolean {
  return range.compareBoundaryPoints(Range.END_TO_START, other) < 0;
}

function overlaps(left: Range, right: Range): boolean {
  return startsBeforeEndOf(left, right) && startsBeforeEndOf(right, left);
}

function bubbleRank(annotation: Annotation): number {
  if (annotation.type === 'ai_question') return BubbleOrder.question;
  if (annotation.tags.includes(AI_TAG)) return BubbleOrder.ai;

  return BubbleOrder.yours;
}

export function annotationsAtPassage(
  annotationId: string,
  ordered: Annotation[],
  ranges: RangeMap
): Annotation[] {
  const passage = ranges.get(annotationId);

  if (!passage) return [];

  return ordered
    .filter(annotation => overlaps(passage, ranges.get(annotation.id)!))
    .sort((left, right) => bubbleRank(left) - bubbleRank(right));
}

export type NotedPassage = {
  annotationId: string;
  range: Range;
};

export function notedPassages(ordered: Annotation[], ranges: RangeMap): NotedPassage[] {
  const passages: NotedPassage[] = [];

  for (const annotation of ordered.filter(hasNote)) {
    const range = ranges.get(annotation.id)!;

    if (!passages.some(passage => overlaps(passage.range, range))) {
      passages.push({ annotationId: annotation.id, range });
    }
  }

  return passages;
}

export function lastLineOf(range: Range): DOMRect | undefined {
  const lines = Array.from(range.getClientRects()).filter(rect => rect.width > 0);

  return lines.at(-1);
}
