'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const NEXT: Record<Theme, Theme> = {
  dark: 'system',
  light: 'dark',
  system: 'light',
};

const LABEL: Record<Theme, string> = {
  dark: '☾ Dark',
  light: '☀ Light',
  system: '◐ Auto',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      setTheme((localStorage.getItem('theme') as Theme) || 'system');
    } catch {}
  }, []);

  function apply(next: Theme) {
    setTheme(next);

    try {
      localStorage.setItem('theme', next);
    } catch {}

    const resolved =
      next === 'system'
        ? matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : next;

    document.documentElement.dataset.theme = resolved;
  }

  return (
    <button
      onClick={() => apply(NEXT[theme])}
      className="rounded px-2 py-1 text-xs text-muted hover:bg-panel hover:text-ink"
      title="Theme"
    >
      {LABEL[theme]}
    </button>
  );
}
