import Link from 'next/link';

import type { ChapterLink } from './reader-types';

type ChapterNavigationProps = {
  docId: string;
  next: ChapterLink | null;
  prev: ChapterLink | null;
};

const CARD_CLASS = 'rounded-lg border border-line p-3 hover:border-accent';
const END_CARD_CLASS = 'rounded-lg border border-line p-3 text-right hover:border-accent';

export function ChapterNavigation({ docId, next, prev }: ChapterNavigationProps) {
  return (
    <nav className="mx-auto mt-12 grid max-w-[680px] grid-cols-2 gap-4 border-t border-line pt-6 text-sm">
      {prev ? (
        <NavigationCard href={`/read/${docId}/${prev.id}`} label="← Previous" title={prev.title} />
      ) : (
        <span />
      )}
      {next ? (
        <NavigationCard
          href={`/read/${docId}/${next.id}`}
          label="Next →"
          title={next.title}
          alignEnd
        />
      ) : (
        <NavigationCard
          href={`/read/${docId}`}
          label="Finished"
          title="Back to contents"
          alignEnd
        />
      )}
    </nav>
  );
}

type NavigationCardProps = {
  alignEnd?: boolean;
  href: string;
  label: string;
  title: string;
};

function NavigationCard({ alignEnd, href, label, title }: NavigationCardProps) {
  return (
    <Link href={href} className={alignEnd ? END_CARD_CLASS : CARD_CLASS}>
      <div className="text-xs text-muted">{label}</div>
      <div className="truncate font-serif">{title}</div>
    </Link>
  );
}
