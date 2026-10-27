'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { ChapterLink } from './reader-types';

type ChapterKeyboardOptions = {
  docId: string;
  next: ChapterLink | null;
  onEscape: () => void;
  prev: ChapterLink | null;
};

function isTypingInField(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable]'));
}

function isModalOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

function isTypingOrShortcut(event: KeyboardEvent): boolean {
  return (
    isModalOpen() || isTypingInField(event.target) || event.metaKey || event.ctrlKey || event.altKey
  );
}

export function useChapterKeyboard({ docId, next, onEscape, prev }: ChapterKeyboardOptions) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingOrShortcut(event)) return;
      if (event.key === 'ArrowRight' && next) router.push(`/read/${docId}/${next.id}`);
      if (event.key === 'ArrowLeft' && prev) router.push(`/read/${docId}/${prev.id}`);
      if (event.key === 'Escape') onEscape();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, docId, next, prev, onEscape]);
}
