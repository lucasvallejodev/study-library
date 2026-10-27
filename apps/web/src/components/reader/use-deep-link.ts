'use client';

import { useEffect, useRef } from 'react';

import type { ElementRef, RangeMap } from './reader-types';

const ANNOTATION_HASH_PREFIX = 'a-';
const RESTORE_AFTER_FRACTION = 0.02;
const RESTORE_BEFORE_FRACTION = 0.98;
const RESTORED_LINE_VIEWPORT_FRACTION = 0.3;

type DeepLinkOptions = {
  anchored: boolean;
  articleRef: ElementRef<HTMLElement>;
  initialPosition: number;
  onUnplacedLink: (annotationId: string) => void;
  pulseAnnotation: (annotationId: string) => void;
  ranges: RangeMap;
};

function currentHash(): string {
  return decodeURIComponent(location.hash.slice(1));
}

function isAnnotationHash(hash: string): boolean {
  return hash.startsWith(ANNOTATION_HASH_PREFIX);
}

function isMidChapter(position: number): boolean {
  return position > RESTORE_AFTER_FRACTION && position < RESTORE_BEFORE_FRACTION;
}

function scrollToSavedPosition(article: HTMLElement, position: number) {
  if (!isMidChapter(position)) return;
  const top = article.getBoundingClientRect().top + window.scrollY;

  window.scrollTo({
    top:
      top + position * article.offsetHeight - window.innerHeight * RESTORED_LINE_VIEWPORT_FRACTION,
  });
}

export function useDeepLink(options: DeepLinkOptions) {
  const { anchored, articleRef, initialPosition, onUnplacedLink, pulseAnnotation, ranges } =
    options;

  const restored = useRef(false);

  useEffect(() => {
    const article = articleRef.current;

    if (restored.current || !article || !anchored) return;
    restored.current = true;
    const hash = currentHash();

    if (isAnnotationHash(hash)) {
      if (ranges.has(hash)) pulseAnnotation(hash);
      else onUnplacedLink(hash);

      return;
    }

    if (!hash) scrollToSavedPosition(article, initialPosition);
  }, [anchored, articleRef, initialPosition, onUnplacedLink, pulseAnnotation, ranges]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = currentHash();

      if (isAnnotationHash(hash)) pulseAnnotation(hash);
    };

    window.addEventListener('hashchange', onHashChange);

    return () => window.removeEventListener('hashchange', onHashChange);
  }, [pulseAnnotation]);
}
