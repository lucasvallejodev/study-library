'use client';

import { useEffect, useState } from 'react';

import type { ElementRef } from './reader-types';

export function useLayoutTick(articleRef: ElementRef<HTMLElement>): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const relayout = () => setTick(count => count + 1);
    const observer = new ResizeObserver(relayout);

    if (articleRef.current) observer.observe(articleRef.current);
    window.addEventListener('resize', relayout);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', relayout);
    };
  }, [articleRef]);

  return tick;
}
