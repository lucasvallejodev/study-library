import { NextResponse } from 'next/server';

import { type LibraryCard, listLibrary } from '@/lib/data';
import { route } from '@/lib/http';
import { isFlagSet, searchParamsOf } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

const PERCENT_DECIMALS_FACTOR = 100;

type ChapterSummary = Pick<
  LibraryCard['doc']['chapters'][number],
  'id' | 'matter' | 'order' | 'title' | 'wordCount'
>;

const roundToHundredths = (value: number): number =>
  Math.round(value * PERCENT_DECIMALS_FACTOR) / PERCENT_DECIMALS_FACTOR;

const chapterSummaries = (card: LibraryCard): ChapterSummary[] =>
  card.doc.chapters.map(({ id, matter, order, title, wordCount }) => ({
    id,
    matter,
    order,
    title,
    wordCount,
  }));

const documentSummary = (card: LibraryCard, withChapters: boolean): Record<string, unknown> => {
  const { annotationCount, doc, lastRead, percent } = card;

  return {
    annotationCount,
    authors: doc.authors,
    chapterCount: doc.chapters.length,
    id: doc.id,
    kind: doc.kind,
    lastRead: lastRead?.toISOString() ?? null,
    percent: roundToHundredths(percent),
    title: doc.title,
    ...(withChapters ? { chapters: chapterSummaries(card) } : {}),
  };
};

export const GET = route(async (req: Request) => {
  const withChapters = isFlagSet(searchParamsOf(req), 'chapters');
  const cards = await listLibrary();

  return NextResponse.json(cards.map(card => documentSummary(card, withChapters)));
});
