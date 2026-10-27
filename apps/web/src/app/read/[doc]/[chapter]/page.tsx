import { and, eq } from 'drizzle-orm';
import type { Metadata } from 'next';

import { Reader } from '@/components/reader/Reader';
import { listAnnotations, loadChapter, toAnnotation } from '@/lib/data';
import { getDb, t } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ chapter: string; doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapter, doc } = await params;

  try {
    const loaded = await loadChapter(doc, chapter);

    return { title: `${loaded.chapter.title} — ${loaded.doc.title}` };
  } catch {
    return { title: 'Not found' };
  }
}

export default async function ChapterPage({ params }: Props) {
  const { chapter: chapterId, doc: docId } = await params;
  const { chapter, doc, next, prev, rendered } = await loadChapter(docId, chapterId);

  const annotations = (await listAnnotations({ chapterId, documentId: docId }))
    .reverse()
    .map(toAnnotation);

  const [progress] = await getDb()
    .select()
    .from(t.readingProgress)
    .where(
      and(eq(t.readingProgress.documentId, docId), eq(t.readingProgress.chapterId, chapterId))
    );

  return (
    <Reader
      doc={{
        authors: doc.authors,
        id: doc.id,
        title: doc.title,
      }}
      chapter={{
        id: chapter.id,
        order: chapter.order,
        sourceUrl: chapter.sourceUrl,
        title: chapter.title,
        wordCount: chapter.wordCount,
      }}
      toc={doc.chapters.map(c => ({
        depth: c.depth,
        id: c.id,
        matter: c.matter,
        title: c.title,
      }))}
      html={rendered.html}
      prev={prev ? { id: prev.id, title: prev.title } : null}
      next={next ? { id: next.id, title: next.title } : null}
      initialAnnotations={annotations}
      initialPosition={progress?.position ?? 0}
    />
  );
}
