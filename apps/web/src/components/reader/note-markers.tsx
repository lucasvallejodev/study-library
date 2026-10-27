'use client';

import { useLayoutEffect, useState } from 'react';

import type { Annotation } from '@study/core';

import { lastLineOf, notedPassages } from './passages';
import type { ElementRef, RangeMap } from './reader-types';
import { useLayoutTick } from './use-layout-tick';

const MARKER_SIZE = 8;
const MARKER_GAP = 3;

type Marker = {
  annotationId: string;
  left: number;
  top: number;
};

type NoteMarkersProps = {
  articleRef: ElementRef<HTMLElement>;
  onOpen: (annotationId: string) => void;
  ordered: Annotation[];
  ranges: RangeMap;
  wrapperRef: ElementRef<HTMLDivElement>;
};

function measureMarkers(ordered: Annotation[], ranges: RangeMap, wrapper: HTMLElement): Marker[] {
  const origin = wrapper.getBoundingClientRect();

  return notedPassages(ordered, ranges).flatMap(({ annotationId, range }) => {
    const line = lastLineOf(range);

    if (!line) return [];

    return [
      {
        annotationId,
        left: line.right - origin.left + MARKER_GAP,
        top: line.top - origin.top,
      },
    ];
  });
}

function useMarkers(props: NoteMarkersProps): Marker[] {
  const { articleRef, ordered, ranges, wrapperRef } = props;
  const tick = useLayoutTick(articleRef);
  const [markers, setMarkers] = useState<Marker[]>([]);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;

    setMarkers(wrapper ? measureMarkers(ordered, ranges, wrapper) : []);
  }, [ordered, ranges, tick, wrapperRef]);

  return markers;
}

export function NoteMarkers(props: NoteMarkersProps) {
  const markers = useMarkers(props);

  return markers.map(marker => (
    <button
      key={marker.annotationId}
      onClick={() => props.onOpen(marker.annotationId)}
      aria-label="Open the notes on this passage"
      title="Notes"
      className="absolute z-5 rounded-full bg-accent ring-2 ring-paper hover:scale-125"
      style={{
        height: MARKER_SIZE,
        left: marker.left,
        top: marker.top,
        width: MARKER_SIZE,
      }}
    />
  ));
}
