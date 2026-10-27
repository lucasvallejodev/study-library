import { eq, sql } from 'drizzle-orm';

import {
  documentDir,
  listDocumentIds,
  readChapterBody,
  readDocument,
  stripMarkdown,
} from '../library';
import type { ChapterEntry, LibraryDocument } from '../schemas';
import type { Db } from './index';
import { chapters, documents } from './schema';

const CHAPTER_INSERT_BATCH_SIZE = 50;

type ChapterRow = typeof chapters.$inferInsert;

const toChapterRow = async (doc: LibraryDocument, chapter: ChapterEntry): Promise<ChapterRow> => ({
  contentHash: chapter.contentHash,
  depth: chapter.depth,
  documentId: doc.id,
  file: chapter.file,
  id: chapter.id,
  matter: chapter.matter,
  order: chapter.order,
  plainText: stripMarkdown(await readChapterBody(doc.id, chapter)),
  title: chapter.title,
  wordCount: chapter.wordCount,
});

const documentFields = (doc: LibraryDocument): Omit<typeof documents.$inferInsert, 'id'> => ({
  authors: doc.authors,
  cover: doc.cover ?? null,
  importedAt: new Date(doc.source.importedAt),
  kind: doc.kind,
  path: documentDir(doc.id),
  sourceType: doc.source.type,
  sourceUrl: ('url' in doc.source && doc.source.url) || null,
  title: doc.title,
});

const inBatches = <Item>(items: Item[], size: number): Item[][] => {
  const batches: Item[][] = [];

  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }

  return batches;
};

/**
 * Rebuilds the database rows of one document from `library/<id>`.
 *
 * @remarks
 * Upserts the document row and replaces all its chapter rows in one transaction.
 * Annotations are untouched.
 *
 * @param db - Database handle.
 * @param docId - Document id (a lowercase slug).
 * @returns Resolves once the transaction commits.
 * @throws Error when the document cannot be read or validated, or a query fails.
 */
export const indexDocument = async (db: Db, docId: string): Promise<void> => {
  const doc = await readDocument(docId);
  const rows = await Promise.all(doc.chapters.map(chapter => toChapterRow(doc, chapter)));
  const fields = documentFields(doc);

  await db.transaction(async tx => {
    await tx
      .insert(documents)
      .values({ ...fields, id: doc.id })
      .onConflictDoUpdate({
        set: { ...fields, updatedAt: sql`now()` },
        target: documents.id,
      });
    await tx.delete(chapters).where(eq(chapters.documentId, doc.id));

    for (const batch of inBatches(rows, CHAPTER_INSERT_BATCH_SIZE)) {
      await tx.insert(chapters).values(batch);
    }
  });
};

/**
 * Rebuilds the index for every document on disk and drops rows for folders that are gone.
 *
 * @param db - Database handle.
 * @returns The ids that were indexed and the ids whose rows were removed.
 * @throws Error when a document cannot be read or validated, or a query fails.
 */
export const reindexLibrary = async (db: Db): Promise<{ indexed: string[]; removed: string[] }> => {
  const ids = await listDocumentIds();

  for (const id of ids) await indexDocument(db, id);
  const existing = await db.select({ id: documents.id }).from(documents);
  const removed = existing.map(row => row.id).filter(id => !ids.includes(id));

  for (const id of removed) await db.delete(documents).where(eq(documents.id, id));

  return { indexed: ids, removed };
};
