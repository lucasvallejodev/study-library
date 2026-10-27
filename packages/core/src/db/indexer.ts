import { eq, sql } from 'drizzle-orm';

import {
  documentDir,
  listDocumentIds,
  readChapterBody,
  readDocument,
  stripMarkdown,
} from '../library';
import type { Db } from './index';
import { chapters, documents } from './schema';

/**
 * (Re)build the DB rows for one document from library/<id>. Annotations are untouched.
 *
 * @param db
 * @param docId
 */
export const indexDocument = async (db: Db, docId: string): Promise<void> => {
  const doc = await readDocument(docId);

  const rows = await Promise.all(
    doc.chapters.map(async c => ({
      contentHash: c.contentHash,
      depth: c.depth,
      documentId: doc.id,
      file: c.file,
      id: c.id,
      matter: c.matter,
      order: c.order,
      plainText: stripMarkdown(await readChapterBody(doc.id, c)),
      title: c.title,
      wordCount: c.wordCount,
    }))
  );

  const sourceUrl = ('url' in doc.source && doc.source.url) || null;

  await db.transaction(async tx => {
    await tx
      .insert(documents)
      .values({
        authors: doc.authors,
        cover: doc.cover ?? null,
        id: doc.id,
        importedAt: new Date(doc.source.importedAt),
        kind: doc.kind,
        path: documentDir(doc.id),
        sourceType: doc.source.type,
        sourceUrl,
        title: doc.title,
      })
      .onConflictDoUpdate({
        set: {
          authors: doc.authors,
          cover: doc.cover ?? null,
          importedAt: new Date(doc.source.importedAt),
          kind: doc.kind,
          path: documentDir(doc.id),
          sourceType: doc.source.type,
          sourceUrl,
          title: doc.title,
          updatedAt: sql`now()`,
        },
        target: documents.id,
      });
    await tx.delete(chapters).where(eq(chapters.documentId, doc.id));

    for (let i = 0; i < rows.length; i += 50) {
      await tx.insert(chapters).values(rows.slice(i, i + 50));
    }
  });
};

/**
 * Rebuild the index for every document on disk and drop rows for folders that are gone.
 *
 * @param db
 */
export const reindexLibrary = async (db: Db): Promise<{ indexed: string[]; removed: string[] }> => {
  const ids = await listDocumentIds();

  for (const id of ids) await indexDocument(db, id);
  const existing = await db.select({ id: documents.id }).from(documents);
  const removed = existing.map(r => r.id).filter(id => !ids.includes(id));

  for (const id of removed) await db.delete(documents).where(eq(documents.id, id));

  return { indexed: ids, removed };
};
