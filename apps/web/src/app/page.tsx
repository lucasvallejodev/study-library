import Link from 'next/link';

import { Cover, ProgressBar, relativeTime, roundedPercent } from '@/components/ui';
import { type LibraryCard, listLibrary } from '@/lib/data';

export const dynamic = 'force-dynamic';

const CONTINUE_READING_LIMIT = 3;
const FINISHED_FRACTION = 0.99;

export default async function LibraryPage() {
  const cards = await listLibrary();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {cards.length === 0 ? <EmptyLibrary /> : <Library cards={cards} />}
    </main>
  );
}

function unfinishedReads(cards: LibraryCard[]): LibraryCard[] {
  return cards
    .filter(card => card.lastRead && card.percent < FINISHED_FRACTION)
    .slice(0, CONTINUE_READING_LIMIT);
}

function EmptyLibrary() {
  return (
    <div className="mx-auto mt-20 max-w-md text-center">
      <h1 className="font-serif text-3xl">Your library is empty</h1>
      <p className="mt-3 text-muted">
        Import an EPUB, a MOBI file or a web article to start reading.
      </p>
      <Link href="/import" className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-white">
        Import something
      </Link>
    </div>
  );
}

function Library({ cards }: { cards: LibraryCard[] }) {
  const reading = unfinishedReads(cards);

  return (
    <>
      {reading.length > 0 && <ContinueReading cards={reading} />}
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Library</h1>
        <span className="text-sm text-muted">{cards.length} documents</span>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {cards.map(card => (
          <DocumentTile key={card.doc.id} card={card} />
        ))}
      </div>
    </>
  );
}

function ContinueReading({ cards }: { cards: LibraryCard[] }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Continue reading
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(card => (
          <ContinueReadingCard key={card.doc.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function ContinueReadingCard({ card }: { card: LibraryCard }) {
  const { doc, lastChapterId, lastRead, percent } = card;
  const chapter = doc.chapters.find(candidate => candidate.id === lastChapterId);

  return (
    <Link
      href={`/read/${doc.id}/${lastChapterId}`}
      className="rounded-lg border border-line bg-panel p-4 hover:border-accent"
    >
      <div className="truncate font-serif text-lg">{doc.title}</div>
      <div className="truncate text-sm text-muted">{chapter?.title}</div>
      <ProgressBar value={percent} className="mt-3" />
      <div className="mt-1 text-xs text-muted">
        {roundedPercent(percent)}% · {relativeTime(lastRead)}
      </div>
    </Link>
  );
}

function readingStatus({ annotationCount, lastRead, percent }: LibraryCard): string {
  const parts = [percent > 0 ? `${roundedPercent(percent)}%` : 'Not started'];

  if (annotationCount > 0) parts.push(`${annotationCount} notes`);
  if (lastRead) parts.push(relativeTime(lastRead));

  return parts.join(' · ');
}

function DocumentTile({ card }: { card: LibraryCard }) {
  const { doc } = card;

  return (
    <Link href={`/read/${doc.id}`} className="group">
      <Cover
        docId={doc.id}
        cover={doc.cover}
        title={doc.title}
        className="transition group-hover:shadow-lg"
      />
      <div className="mt-2 line-clamp-2 font-serif leading-snug">{doc.title}</div>
      <div className="truncate text-sm text-muted">{doc.authors.join(', ') || doc.kind}</div>
      <ProgressBar value={card.percent} className="mt-2" />
      <div className="mt-1 text-xs text-muted">{readingStatus(card)}</div>
    </Link>
  );
}
