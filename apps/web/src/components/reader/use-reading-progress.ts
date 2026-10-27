'use client';

import { useEffect, useState } from 'react';

import type { ElementRef } from './reader-types';

const PROGRESS_SAVE_DELAY_MS = 1200;
const READING_LINE_VIEWPORT_FRACTION = 0.5;

type ReadingProgressOptions = {
  articleRef: ElementRef<HTMLElement>;
  chapterId: string;
  docId: string;
  initialPosition: number;
};

type ProgressTarget = {
  chapterId: string;
  docId: string;
};

function clampFraction(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function readingPosition(article: HTMLElement): number {
  const top = article.getBoundingClientRect().top + window.scrollY;
  const readingLine = window.innerHeight * READING_LINE_VIEWPORT_FRACTION;
  const height = Math.max(1, article.offsetHeight - readingLine);

  return clampFraction((window.scrollY - top + readingLine) / height);
}

function saveProgress(target: ProgressTarget, position: number, useBeacon: boolean) {
  const body = JSON.stringify({
    chapterId: target.chapterId,
    documentId: target.docId,
    position,
  });

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/progress', new Blob([body], { type: 'application/json' }));

    return;
  }

  void fetch('/api/progress', {
    body,
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    method: 'POST',
  });
}

export function useReadingProgress(options: ReadingProgressOptions): number {
  const { articleRef, chapterId, docId, initialPosition } = options;
  const [progress, setProgress] = useState(initialPosition);

  useEffect(() => {
    const target = { chapterId, docId };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = initialPosition;

    const onScroll = () => {
      const article = articleRef.current;

      if (!article) return;
      latest = readingPosition(article);
      setProgress(latest);
      clearTimeout(timer);
      timer = setTimeout(() => saveProgress(target, latest, false), PROGRESS_SAVE_DELAY_MS);
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') saveProgress(target, latest, true);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [articleRef, chapterId, docId, initialPosition]);

  return progress;
}
