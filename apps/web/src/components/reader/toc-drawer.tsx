'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type TocItem = {
  depth: number;
  id: string;
  matter: 'front' | 'body' | 'back';
  title: string;
};

type TocDrawerProps = {
  currentId: string;
  docId: string;
  docTitle: string;
  items: TocItem[];
  onClose: () => void;
  open: boolean;
};

const BASE_INDENT_REM = 1;
const INDENT_PER_LEVEL_REM = 0.75;

function tocIndent(depth: number): string {
  return `${BASE_INDENT_REM + (depth - 1) * INDENT_PER_LEVEL_REM}rem`;
}

function tocLinkClass(item: TocItem, current: boolean): string {
  const highlight = current ? 'bg-panel font-semibold text-accent' : '';
  const dimmed = item.matter !== 'body' ? 'text-muted' : '';

  return `block px-4 py-1.5 font-serif hover:bg-panel ${highlight} ${dimmed}`;
}

export function TocDrawer(props: TocDrawerProps) {
  const { currentId, docId, docTitle, items, onClose, open } = props;
  const current = items.find(item => item.id === currentId);
  const [showAll, setShowAll] = useState(current?.matter !== 'body');
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'center' });
  }, [open]);

  if (!open) return null;
  const visibleItems = showAll ? items : items.filter(item => item.matter === 'body');

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <nav
        className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-line bg-paper shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-line p-4">
          <Link
            href={`/read/${docId}`}
            className="font-serif text-lg leading-tight hover:text-accent"
          >
            {docTitle}
          </Link>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={showAll}
              onChange={event => setShowAll(event.target.checked)}
            />
            Show front and back matter
          </label>
        </div>
        <ol className="flex-1 overflow-y-auto py-2 text-sm">
          {visibleItems.map(item => (
            <li key={item.id}>
              <Link
                ref={item.id === currentId ? activeRef : undefined}
                href={`/read/${docId}/${item.id}`}
                onClick={onClose}
                className={tocLinkClass(item, item.id === currentId)}
                style={{ paddingLeft: tocIndent(item.depth) }}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
