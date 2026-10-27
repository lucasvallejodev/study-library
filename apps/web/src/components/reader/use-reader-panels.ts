'use client';

import { useMemo, useState } from 'react';

export type ReaderPanels = {
  closeAll: () => void;
  closeSheet: () => void;
  closeToc: () => void;
  openSheet: () => void;
  openToc: () => void;
  sheetOpen: boolean;
  tocOpen: boolean;
  toggleSheet: () => void;
};

export function useReaderPanels(): ReaderPanels {
  const [tocOpen, setTocOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const actions = useMemo(
    () => ({
      closeAll: () => {
        setTocOpen(false);
        setSheetOpen(false);
      },
      closeSheet: () => setSheetOpen(false),
      closeToc: () => setTocOpen(false),
      openSheet: () => setSheetOpen(true),
      openToc: () => setTocOpen(true),
      toggleSheet: () => setSheetOpen(open => !open),
    }),
    []
  );

  return {
    ...actions,
    sheetOpen,
    tocOpen,
  };
}
