import type { Metadata } from 'next';

import { Reader } from '@/components/reader/reader';
import type { ChapterLink } from '@/components/reader/reader-types';
import type { TocItem } from '@/components/reader/toc-drawer';
import { listAnnotations, loadChapter, toAnnotation } from '@/lib/data';
import { savedChapterPosition } from '@/lib/progress';
import type { Annotation, ChapterEntry, LibraryDocument } from '@study/core';

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
  const annotations = await loadChapterAnnotations(docId, chapterId);
  const savedPosition = await savedChapterPosition(docId, chapterId);

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
      toc={tocItemsOf(doc)}
      html={rendered.html}
      prev={chapterLinkOf(prev)}
      next={chapterLinkOf(next)}
      initialAnnotations={annotations}
      initialPosition={savedPosition}
    />
  );
}

async function loadChapterAnnotations(docId: string, chapterId: string): Promise<Annotation[]> {
  const rows = await listAnnotations({ chapterId, documentId: docId });

  rows.reverse();

  return rows.map(toAnnotation);
}

function tocItemsOf(doc: LibraryDocument): TocItem[] {
  return doc.chapters.map(chapter => ({
    depth: chapter.depth,
    id: chapter.id,
    matter: chapter.matter,
    title: chapter.title,
  }));
}

function chapterLinkOf(chapter: ChapterEntry | null | undefined): ChapterLink | null {
  return chapter ? { id: chapter.id, title: chapter.title } : null;
}
