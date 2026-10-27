'use client';

import { useEffect } from 'react';

import type { Annotation } from '@study/core';

import { type AnchoredAnnotation, clearHighlights, paintHighlights } from './paint';
import type { RangeMap } from './reader-types';

function withRanges(annotations: Annotation[], ranges: RangeMap): AnchoredAnnotation[] {
  return annotations.flatMap(annotation => {
    const range = ranges.get(annotation.id);

    return range ? [{ annotation, range }] : [];
  });
}

export function usePaintedHighlights(
  annotations: Annotation[],
  ranges: RangeMap,
  highlightedId: string | undefined
) {
  useEffect(() => {
    paintHighlights(withRanges(annotations, ranges), highlightedId);
  }, [annotations, ranges, highlightedId]);

  useEffect(() => clearHighlights, []);
}
