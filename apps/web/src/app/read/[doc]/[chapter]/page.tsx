import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getDb, t } from "@/lib/db";
import { listAnnotations, loadChapter, toAnnotation } from "@/lib/data";
import { Reader } from "@/components/reader/Reader";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ doc: string; chapter: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc, chapter } = await params;
  try {
    const loaded = await loadChapter(doc, chapter);
    return { title: `${loaded.chapter.title} — ${loaded.doc.title}` };
  } catch {
    return { title: "Not found" };
  }
}

export default async function ChapterPage({ params }: Props) {
  const { doc: docId, chapter: chapterId } = await params;
  const { doc, chapter, rendered, prev, next } = await loadChapter(docId, chapterId);
  const annotations = (await listAnnotations({ documentId: docId, chapterId })).reverse().map(toAnnotation);
  const [progress] = await getDb()
    .select()
    .from(t.readingProgress)
    .where(and(eq(t.readingProgress.documentId, docId), eq(t.readingProgress.chapterId, chapterId)));

  return (
    <Reader
      doc={{ id: doc.id, title: doc.title, authors: doc.authors }}
      chapter={{ id: chapter.id, title: chapter.title, order: chapter.order, wordCount: chapter.wordCount, sourceUrl: chapter.sourceUrl }}
      toc={doc.chapters.map((c) => ({ id: c.id, title: c.title, matter: c.matter, depth: c.depth }))}
      html={rendered.html}
      prev={prev ? { id: prev.id, title: prev.title } : null}
      next={next ? { id: next.id, title: next.title } : null}
      initialAnnotations={annotations}
      initialPosition={progress?.position ?? 0}
    />
  );
}
