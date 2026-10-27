import { NextResponse } from 'next/server';

import { listLibrary } from '@/lib/data';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/documents?chapters=1 — documents (and optionally their chapter lists). */
export const GET = route(async (req: Request) => {
  const withChapters = new URL(req.url).searchParams.get('chapters') === '1';
  const cards = await listLibrary();

  return NextResponse.json(
    cards.map(({ annotationCount, doc, lastRead, percent }) => ({
      annotationCount,
      authors: doc.authors,
      chapterCount: doc.chapters.length,
      id: doc.id,
      kind: doc.kind,
      lastRead: lastRead?.toISOString() ?? null,
      percent: Math.round(percent * 100) / 100,
      title: doc.title,
      ...(withChapters
        ? {
            chapters: doc.chapters.map(({ id, matter, order, title, wordCount }) => ({
              id,
              matter,
              order,
              title,
              wordCount,
            })),
          }
        : {}),
    }))
  );
});
