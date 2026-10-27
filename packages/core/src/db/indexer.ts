import { eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { chapters, documents } from "./schema";
import { documentDir, listDocumentIds, readChapterBody, readDocument, stripMarkdown } from "../library";

/** (Re)build the DB rows for one document from library/<id>. Annotations are untouched. */
export async function indexDocument(db: Db, docId: string): Promise<void> {
  const doc = await readDocument(docId);
  const rows = await Promise.all(
    doc.chapters.map(async (c) => ({
      documentId: doc.id,
      id: c.id,
      order: c.order,
      title: c.title,
      file: c.file,
      matter: c.matter,
      depth: c.depth,
      contentHash: c.contentHash,
      wordCount: c.wordCount,
      plainText: stripMarkdown(await readChapterBody(doc.id, c)),
    })),
  );
  const sourceUrl = "url" in doc.source ? doc.source.url : null;
  await db.transaction(async (tx) => {
    await tx
      .insert(documents)
      .values({
        id: doc.id,
        title: doc.title,
        authors: doc.authors,
        kind: doc.kind,
        path: documentDir(doc.id),
        cover: doc.cover ?? null,
        sourceType: doc.source.type,
        sourceUrl,
        importedAt: new Date(doc.source.importedAt),
      })
      .onConflictDoUpdate({
        target: documents.id,
        set: {
          title: doc.title,
          authors: doc.authors,
          kind: doc.kind,
          path: documentDir(doc.id),
          cover: doc.cover ?? null,
          sourceType: doc.source.type,
          sourceUrl,
          importedAt: new Date(doc.source.importedAt),
          updatedAt: sql`now()`,
        },
      });
    await tx.delete(chapters).where(eq(chapters.documentId, doc.id));
    for (let i = 0; i < rows.length; i += 50) await tx.insert(chapters).values(rows.slice(i, i + 50));
  });
}

/** Rebuild the index for every document on disk and drop rows for folders that are gone. */
export async function reindexLibrary(db: Db): Promise<{ indexed: string[]; removed: string[] }> {
  const ids = await listDocumentIds();
  for (const id of ids) await indexDocument(db, id);
  const existing = await db.select({ id: documents.id }).from(documents);
  const removed = existing.map((r) => r.id).filter((id) => !ids.includes(id));
  for (const id of removed) await db.delete(documents).where(eq(documents.id, id));
  return { indexed: ids, removed };
}
