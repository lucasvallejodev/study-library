import { NextResponse } from 'next/server';

import { chapterWithAnnotations } from '@/lib/chapter-export';
import { listAnnotations, loadChapter, toAnnotation } from '@/lib/data';
import { route } from '@/lib/http';
import { publicOrigin } from '@/lib/origin';

type Ctx = { params: Promise<{ chapter: string; doc: string }> };

/**
 * GET /api/documents/:doc/chapters/:chapter
 *   ?format=md                    raw chapter Markdown
 *   ?format=md&annotations=1      Markdown with highlights inlined (==text== [^id]) for AI tools
 *   default                       JSON with markdown, rendered text, annotations
 */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { chapter, doc } = await params;
  const url = new URL(req.url);
  const loaded = await loadChapter(doc, chapter);
  const withAnnotations = url.searchParams.get('annotations') === '1';

  const annotations =
    withAnnotations || url.searchParams.get('format') !== 'md'
      ? (await listAnnotations({ chapterId: chapter, documentId: doc })).reverse()
      : [];

  if (url.searchParams.get('format') === 'md') {
    const body = withAnnotations
      ? chapterWithAnnotations({
          annotations,
          chapterId: chapter,
          docId: doc,
          markdown: loaded.markdown,
          origin: publicOrigin(req),
          title: loaded.chapter.title,
        })
      : loaded.markdown;

    return new Response(body, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
  }

  return NextResponse.json({
    annotations: annotations.map(toAnnotation),
    chapter: loaded.chapter,
    document: { id: loaded.doc.id, title: loaded.doc.title },
    markdown: loaded.markdown,
    next: loaded.next?.id ?? null,
    prev: loaded.prev?.id ?? null,
  });
});
