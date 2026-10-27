'use client';

import { useCallback, useRef, useState } from 'react';

import { cardElementId, type RangeMap } from './reader-types';

const PULSE_DURATION_MS = 2500;
const VIEWPORT_THIRDS = 3;

export type AnnotationFocus = {
  activeId?: string;
  pulseAnnotation: (id: string) => void;
  selectAnnotation: (id: string) => void;
  setActiveId: (id: string | undefined) => void;
};

function scrollPassageIntoView(range: Range) {
  const rect = range.getBoundingClientRect();

  window.scrollTo({
    behavior: 'smooth',
    top: window.scrollY + rect.top - window.innerHeight / VIEWPORT_THIRDS,
  });
}

function scrollCardIntoView(annotationId: string) {
  document
    .getElementById(cardElementId(annotationId))
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function useAnnotationFocus(ranges: RangeMap): AnnotationFocus {
  const [activeId, setActiveId] = useState<string>();
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const focus = useCallback(
    (id: string, scrollAndPulse: boolean) => {
      setActiveId(id);
      const range = ranges.get(id);

      if (range && scrollAndPulse) scrollPassageIntoView(range);
      scrollCardIntoView(id);
      clearTimeout(pulseTimer.current);

      if (scrollAndPulse) {
        pulseTimer.current = setTimeout(
          () => setActiveId(current => (current === id ? undefined : current)),
          PULSE_DURATION_MS
        );
      }
    },
    [ranges]
  );

  const pulseAnnotation = useCallback((id: string) => focus(id, true), [focus]);
  const selectAnnotation = useCallback((id: string) => focus(id, false), [focus]);

  return {
    activeId,
    pulseAnnotation,
    selectAnnotation,
    setActiveId,
  };
}
