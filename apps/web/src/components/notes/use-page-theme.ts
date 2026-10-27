'use client';

import { useSyncExternalStore } from 'react';

export type PageTheme = 'dark' | 'light';

function subscribe(listener: () => void): () => void {
  const observer = new MutationObserver(listener);

  observer.observe(document.documentElement, { attributeFilter: ['data-theme'], attributes: true });

  return () => observer.disconnect();
}

function readTheme(): PageTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function lightOnServer(): PageTheme {
  return 'light';
}

export function usePageTheme(): PageTheme {
  return useSyncExternalStore(subscribe, readTheme, lightOnServer);
}
