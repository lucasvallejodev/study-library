'use client';

import { useCallback, useState } from 'react';

const TOAST_DURATION_MS = 2200;

export type Notify = (message: string) => void;

export function useToast(): { flash: Notify; toast?: string } {
  const [toast, setToast] = useState<string>();

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(undefined), TOAST_DURATION_MS);
  }, []);

  return { flash, toast };
}
