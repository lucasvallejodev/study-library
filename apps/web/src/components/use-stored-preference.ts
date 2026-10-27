'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

const Listeners = new Set<Listener>();
const UnsavedPreferences = new Map<string, string>();

function subscribe(listener: Listener): () => void {
  Listeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    Listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    UnsavedPreferences.set(key, value);
  }
}

function readPreference(key: string): string | null {
  return UnsavedPreferences.get(key) ?? readStorage(key);
}

function noPreferenceOnServer(): null {
  return null;
}

export function useStoredPreference(key: string): [string | null, (value: string) => void] {
  const stored = useSyncExternalStore(subscribe, () => readPreference(key), noPreferenceOnServer);

  const save = useCallback(
    (value: string) => {
      writeStorage(key, value);
      Listeners.forEach(listener => listener());
    },
    [key]
  );

  return [stored, save];
}
