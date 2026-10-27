import { NextResponse } from 'next/server';

import { documentProgress, getDocument } from '@/lib/data';
import { chapterAnnotationCounts, deleteDocument } from '@/lib/documents';
import { route } from '@/lib/http';
import { isFlagSet, searchParamsOf } from '@/lib/search-params';

type Ctx = { params: Promise<{ doc: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { doc: id } = await params;
  const doc = await getDocument(id);
  const progress = await documentProgress(id);
  const counts = await chapterAnnotationCounts(id);

  return NextResponse.json({
    ...doc,
    chapters: doc.chapters.map(chapter => ({
      ...chapter,
      annotationCount: counts.find(entry => entry.chapterId === chapter.id)?.count ?? 0,
      percent: progress.find(row => row.chapterId === chapter.id)?.percent ?? 0,
    })),
  });
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { doc: id } = await params;
  const force = isFlagSet(searchParamsOf(req), 'force');

  return NextResponse.json(await deleteDocument(id, force));
});
