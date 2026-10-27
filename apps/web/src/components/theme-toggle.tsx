'use client';

import { useStoredPreference } from '@/components/use-stored-preference';

type Theme = 'light' | 'dark' | 'system';

const NextTheme: Record<Theme, Theme> = {
  dark: 'system',
  light: 'dark',
  system: 'light',
};

const ThemeLabels: Record<Theme, string> = {
  dark: '☾ Dark',
  light: '☀ Light',
  system: '◐ Auto',
};

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;

  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [stored, saveTheme] = useStoredPreference('theme');
  const theme = (stored as Theme | null) || 'system';

  function apply(next: Theme) {
    saveTheme(next);
    document.documentElement.dataset.theme = resolveTheme(next);
  }

  return (
    <button
      onClick={() => apply(NextTheme[theme])}
      className="rounded px-2 py-1 text-xs text-muted hover:bg-panel hover:text-ink"
      title="Theme"
    >
      {ThemeLabels[theme]}
    </button>
  );
}
