'use client';

import { useLayoutEffect, useMemo, useState } from 'react';

import {
  type Anchor,
  describeRange,
  rangeFromOffsets,
  resolveSelectors,
  textOf,
} from '@study/anchoring';
import type { Annotation } from '@study/core';

import { ignoreFailure } from '../annotations';
import { AnnotationApi } from './api';
import type { ElementRef, RangeMap } from './reader-types';

export type AnchoredAnnotations = {
  anchored: boolean;
  ordered: Annotation[];
  ranges: RangeMap;
};

function markOrphaned(annotation: Annotation) {
  void AnnotationApi.update(annotation.id, { orphaned: true }).catch(ignoreFailure);
}

function refreshSelectors(annotation: Annotation, text: string, anchor: Anchor) {
  void AnnotationApi.update(annotation.id, {
    orphaned: false,
    selectors: describeRange(text, anchor.start, anchor.end),
  }).catch(ignoreFailure);
}

function syncStoredAnchor(
  annotation: Annotation,
  text: string,
  anchor: Anchor | null,
  found: boolean
) {
  if (!found && !annotation.orphaned) markOrphaned(annotation);

  if (found && anchor && (annotation.orphaned || anchor.quality !== 'exact')) {
    refreshSelectors(annotation, text, anchor);
  }
}

function anchorAnnotations(root: HTMLElement, annotations: Annotation[]): RangeMap {
  const text = textOf(root);
  const ranges: RangeMap = new Map();

  for (const annotation of annotations) {
    if (!annotation.selectors.length) continue;
    const anchor = resolveSelectors(text, annotation.selectors);
    const range = anchor && rangeFromOffsets(root, anchor.start, anchor.end);

    if (range) ranges.set(annotation.id, range);
    syncStoredAnchor(annotation, text, anchor, Boolean(range));
  }

  return ranges;
}

function inDocumentOrder(annotations: Annotation[], ranges: RangeMap): Annotation[] {
  const placed = annotations.filter(annotation => ranges.has(annotation.id));

  placed.sort((left, right) => {
    const leftRange = ranges.get(left.id)!;
    const rightRange = ranges.get(right.id)!;

    return leftRange.compareBoundaryPoints(Range.START_TO_START, rightRange);
  });

  return placed;
}

export function useAnchoredAnnotations(
  articleRef: ElementRef<HTMLElement>,
  annotations: Annotation[]
): AnchoredAnnotations {
  const [ranges, setRanges] = useState<RangeMap>(new Map());
  const [anchored, setAnchored] = useState(false);

  useLayoutEffect(() => {
    const root = articleRef.current;

    if (!root) return;
    setRanges(anchorAnnotations(root, annotations));
    setAnchored(true);
  }, [annotations, articleRef]);

  const ordered = useMemo(() => inDocumentOrder(annotations, ranges), [annotations, ranges]);

  return {
    anchored,
    ordered,
    ranges,
  };
}
