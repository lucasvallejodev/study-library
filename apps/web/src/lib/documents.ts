import 'server-only';

import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';

import {
  type ChapterEntry,
  documentDir,
  documentExists,
  IdSchema,
  type LibraryDocument,
  readChapterBody,
  readDocument,
} from '@study/core';

import { getDb, t } from './db';
import { HttpError, HttpStatus, notFound } from './http';
import { renderChapter, type RenderedChapter } from './render';
import { countRows } from './sql-conditions';

/** A chapter with its document, neighbours, Markdown source and rendered form. */
export type LoadedChapter = {
  chapter: ChapterEntry;
  doc: LibraryDocument;
  index: number;
  markdown: string;
  next: ChapterEntry | undefined;
  prev: ChapterEntry | undefined;
  rendered: RenderedChapter;
};

/** Number of annotations on one chapter (`null` groups the document-level notes). */
export type ChapterAnnotationCount = {
  chapterId: string | null;
  count: number;
};

/** What {@link deleteDocument} removed. */
export type DeletedDocument = {
  annotationsDeleted: number;
  deleted: string;
};

const isKnownDocumentId = (docId: string): boolean =>
  IdSchema.safeParse(docId).success && documentExists(docId);

/**
 * Reads a document's `document.json` from the library.
 *
 * @param docId - Document slug.
 * @returns The document with its chapter list.
 * @throws {@link HttpError} 404 when the id is not a valid slug or the document does not exist.
 */
export const getDocument = async (docId: string): Promise<LibraryDocument> => {
  if (!isKnownDocumentId(docId)) notFound(`Document ${docId}`);

  return readDocument(docId);
};

/**
 * Loads one chapter: its Markdown, rendered HTML and text, and the chapters around it.
 *
 * @param docId - Document slug.
 * @param chapterId - Chapter id (`ch-NNN`).
 * @returns The loaded chapter; `prev` and `next` are `undefined` at the ends.
 * @throws {@link HttpError} 404 when the document or the chapter does not exist.
 */
export const loadChapter = async (docId: string, chapterId: string): Promise<LoadedChapter> => {
  const doc = await getDocument(docId);
  const index = doc.chapters.findIndex(chapter => chapter.id === chapterId);

  if (index < 0) notFound(`Chapter ${chapterId}`);

  const chapter = doc.chapters[index];
  const markdown = await readChapterBody(docId, chapter);
  const rendered = await renderChapter(docId, markdown, chapter.contentHash);

  return {
    chapter,
    doc,
    index,
    markdown,
    next: doc.chapters[index + 1],
    prev: doc.chapters[index - 1],
    rendered,
  };
};

/**
 * Counts a document's annotations per chapter.
 *
 * @param docId - Document slug.
 * @returns One entry per chapter that has annotations.
 */
export const chapterAnnotationCounts = async (docId: string): Promise<ChapterAnnotationCount[]> =>
  getDb()
    .select({ chapterId: t.annotations.chapterId, count: countRows() })
    .from(t.annotations)
    .where(eq(t.annotations.documentId, docId))
    .groupBy(t.annotations.chapterId);

const countDocumentAnnotations = async (docId: string): Promise<number> => {
  const [{ count }] = (await getDb()
    .select({ count: countRows() })
    .from(t.annotations)
    .where(eq(t.annotations.documentId, docId))) as [{ count: number }];

  return count;
};

const deleteDocumentRows = async (docId: string): Promise<void> => {
  const db = getDb();

  await db.delete(t.annotations).where(eq(t.annotations.documentId, docId));
  await db.delete(t.readingProgress).where(eq(t.readingProgress.documentId, docId));
  await db.delete(t.documents).where(eq(t.documents.id, docId));
};

/**
 * Deletes a document: its annotations, reading progress, index rows and library folder.
 *
 * @remarks
 * Annotations cannot be rebuilt from disk, so the call refuses while any exist unless forced.
 *
 * @param docId - Document slug.
 * @param force - Delete even when the document has annotations.
 * @returns The deleted id and how many annotations went with it.
 * @throws {@link HttpError} 404 when the document does not exist, 409 when it has annotations
 * and `force` is false.
 */
export const deleteDocument = async (docId: string, force: boolean): Promise<DeletedDocument> => {
  await getDocument(docId);

  const annotationCount = await countDocumentAnnotations(docId);

  if (annotationCount > 0 && !force) {
    throw new HttpError(
      HttpStatus.conflict,
      `${docId} has ${annotationCount} annotations. Export them first (lib export ${docId}) or pass force=1.`
    );
  }

  await deleteDocumentRows(docId);
  await rm(documentDir(docId), { force: true, recursive: true });

  return { annotationsDeleted: annotationCount, deleted: docId };
};
