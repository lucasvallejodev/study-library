import 'server-only';

import { type LibraryDocument, listDocumentIds, readDocument } from '@study/core';

import { getDb, t } from './db';
import type { ProgressRow } from './progress';
import { countRows } from './sql-conditions';

/** A document on the library shelf with its reading state. */
export type LibraryCard = {
  annotationCount: number;
  doc: LibraryDocument;
  lastChapterId?: string;
  lastRead?: Date;
  percent: number;
};

type ChapterPercent = {
  chapterId: string;
  percent: number;
};

type DocumentAnnotationCount = {
  count: number;
  documentId: string | null;
};

const readReadableDocuments = async (): Promise<LibraryDocument[]> => {
  const ids = await listDocumentIds();
  const documents = await Promise.all(ids.map(id => readDocument(id).catch(() => undefined)));

  return documents.filter((doc): doc is LibraryDocument => !!doc);
};

const annotationCountsByDocument = async (): Promise<DocumentAnnotationCount[]> =>
  getDb()
    .select({ count: countRows(), documentId: t.annotations.documentId })
    .from(t.annotations)
    .groupBy(t.annotations.documentId);

const newestFirst = (left: ProgressRow, right: ProgressRow): number =>
  right.updatedAt.getTime() - left.updatedAt.getTime();

const toCard = (
  doc: LibraryDocument,
  progress: ProgressRow[],
  counts: DocumentAnnotationCount[]
): LibraryCard => {
  const rows = progress.filter(row => row.documentId === doc.id);
  const latest = rows.toSorted(newestFirst)[0];

  return {
    annotationCount: counts.find(entry => entry.documentId === doc.id)?.count ?? 0,
    doc,
    lastChapterId: latest?.chapterId,
    lastRead: latest?.updatedAt,
    percent: documentPercent(doc, rows),
  };
};

const lastReadTime = (card: LibraryCard): number => card.lastRead?.getTime() ?? 0;

const recentlyReadThenByTitle = (left: LibraryCard, right: LibraryCard): number =>
  lastReadTime(right) - lastReadTime(left) || left.doc.title.localeCompare(right.doc.title);

/**
 * Lists every readable document in the library with its progress and annotation count.
 *
 * @remarks
 * Documents whose `document.json` cannot be read are skipped.
 *
 * @returns The cards, most recently read first, then by title.
 */
export const listLibrary = async (): Promise<LibraryCard[]> => {
  const documents = await readReadableDocuments();
  const progress = await getDb().select().from(t.readingProgress);
  const counts = await annotationCountsByDocument();

  return documents.map(doc => toCard(doc, progress, counts)).sort(recentlyReadThenByTitle);
};

/**
 * Computes the share of body-matter words read, weighting each chapter's progress by its length.
 *
 * @param doc - The document whose body chapters are weighed.
 * @param rows - Reading progress per chapter (0–1); chapters without a row count as unread.
 * @returns A fraction between 0 and 1.
 */
export const documentPercent = (doc: LibraryDocument, rows: ChapterPercent[]): number => {
  const bodyChapters = doc.chapters.filter(chapter => chapter.matter === 'body');
  const totalWords = bodyChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0) || 1;

  const wordsRead = bodyChapters.reduce((sum, chapter) => {
    const percent = rows.find(row => row.chapterId === chapter.id)?.percent ?? 0;

    return sum + chapter.wordCount * percent;
  }, 0);

  return Math.min(1, wordsRead / totalWords);
};
