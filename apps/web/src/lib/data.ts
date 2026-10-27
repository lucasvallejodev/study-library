import 'server-only';

import { and, desc, eq, gte, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import { describeRange, findQuote } from '@study/anchoring';
import {
  type Annotation,
  annotationId,
  documentExists,
  type LibraryDocument,
  listDocumentIds,
  type NewAnnotation,
  readChapterBody,
  readDocument,
  type StudySessionInput,
} from '@study/core';

import { getDb, t } from './db';
import { HttpError, notFound } from './http';
import { renderChapter } from './render';

export type AnnotationRow = typeof t.annotations.$inferSelect;

/**
 *
 * @param row
 */
export const toAnnotation = (row: AnnotationRow): Annotation => ({
  body: row.body,
  chapterId: row.chapterId,
  color: (row.color as Annotation['color']) ?? null,
  createdAt: row.createdAt.toISOString(),
  documentId: row.documentId,
  id: row.id,
  orphaned: row.orphaned,
  selectors: row.selectors,
  tags: row.tags,
  type: row.type as Annotation['type'],
  updatedAt: row.updatedAt.toISOString(),
});

/**
 *
 * @param docId
 */
export const getDocument = async (docId: string): Promise<LibraryDocument> => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(docId) || !documentExists(docId)) notFound(`Document ${docId}`);

  return readDocument(docId);
};

/**
 *
 * @param docId
 * @param chapterId
 */
export const loadChapter = async (docId: string, chapterId: string) => {
  const doc = await getDocument(docId);
  const index = doc.chapters.findIndex(c => c.id === chapterId);

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

// ---- Library overview ----

export type LibraryCard = {
  annotationCount: number;
  doc: LibraryDocument;
  lastChapterId?: string;
  lastRead?: Date;
  percent: number;
};

/**
 *
 */
export const listLibrary = async (): Promise<LibraryCard[]> => {
  const db = getDb();
  const ids = await listDocumentIds();

  const docs = (await Promise.all(ids.map(id => readDocument(id).catch(() => undefined)))).filter(
    (d): d is LibraryDocument => !!d
  );

  const progress = await db.select().from(t.readingProgress);

  const counts = await db
    .select({ documentId: t.annotations.documentId, n: sql<number>`count(*)::int` })
    .from(t.annotations)
    .groupBy(t.annotations.documentId);

  return docs
    .map(doc => {
      const rows = progress.filter(p => p.documentId === doc.id);
      const last = rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

      return {
        annotationCount: counts.find(c => c.documentId === doc.id)?.n ?? 0,
        doc,
        lastChapterId: last?.chapterId,
        lastRead: last?.updatedAt,
        percent: documentPercent(doc, rows),
      };
    })
    .sort(
      (a, b) =>
        (b.lastRead?.getTime() ?? 0) - (a.lastRead?.getTime() ?? 0) ||
        a.doc.title.localeCompare(b.doc.title)
    );
};

/**
 * Share of body-matter words read, weighting each chapter's progress by its length.
 *
 * @param doc
 * @param rows
 */
export const documentPercent = (
  doc: LibraryDocument,
  rows: { chapterId: string; percent: number }[]
): number => {
  const body = doc.chapters.filter(c => c.matter === 'body');
  const total = body.reduce((n, c) => n + c.wordCount, 0) || 1;

  const read = body.reduce(
    (n, c) => n + c.wordCount * (rows.find(r => r.chapterId === c.id)?.percent ?? 0),
    0
  );

  return Math.min(1, read / total);
};

/**
 *
 * @param docId
 */
export const documentProgress = async (docId: string) =>
  getDb().select().from(t.readingProgress).where(eq(t.readingProgress.documentId, docId));

/**
 *
 * @param documentId
 * @param chapterId
 * @param position
 */
export const saveProgress = async (documentId: string, chapterId: string, position: number) => {
  const pos = Math.max(0, Math.min(1, position));
  const percent = pos > 0.97 ? 1 : pos;

  await getDb()
    .insert(t.readingProgress)
    .values({
      chapterId,
      documentId,
      percent,
      position: pos,
    })
    .onConflictDoUpdate({
      // Never lose "finished": percent only moves forward, position follows the reader.
      set: {
        percent: sql`greatest(${t.readingProgress.percent}, ${percent})`,
        position: pos,
        updatedAt: sql`now()`,
      },
      target: [t.readingProgress.documentId, t.readingProgress.chapterId],
    });
};

// ---- Annotations ----

export type AnnotationFilter = {
  chapterId?: string;
  color?: string;
  documentId?: string;
  free?: boolean;
  limit?: number;
  q?: string;
  since?: Date;
  tag?: string;
  type?: string;
};

/**
 *
 * @param f
 */
export const listAnnotations = async (f: AnnotationFilter = {}): Promise<AnnotationRow[]> => {
  const where: SQL[] = [];

  if (f.documentId) where.push(eq(t.annotations.documentId, f.documentId));
  if (f.chapterId) where.push(eq(t.annotations.chapterId, f.chapterId));
  if (f.type) where.push(inArray(t.annotations.type, f.type.split(',')));
  if (f.color) where.push(eq(t.annotations.color, f.color));
  if (f.tag) where.push(sql`${t.annotations.tags} ? ${f.tag}`);
  if (f.since) where.push(gte(t.annotations.updatedAt, f.since));
  if (f.free) where.push(isNull(t.annotations.documentId));
  if (f.q) where.push(sql`${t.annotations.search} @@ websearch_to_tsquery('english', ${f.q})`);

  return getDb()
    .select()
    .from(t.annotations)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(t.annotations.createdAt))
    .limit(f.limit ?? 1000);
};

/**
 *
 * @param id
 */
export const getAnnotation = async (id: string): Promise<AnnotationRow> => {
  const [row] = await getDb().select().from(t.annotations).where(eq(t.annotations.id, id));

  if (!row) notFound(`Annotation ${id}`);

  return row;
};

const quoteOf = (selectors: AnnotationRow['selectors']): string | null => {
  const q = selectors.find(s => s.type === 'TextQuoteSelector');

  return q && q.type === 'TextQuoteSelector' ? q.exact : null;
};

/**
 *
 * @param input
 */
export const createAnnotation = async (input: NewAnnotation): Promise<AnnotationRow> => {
  let selectors = input.selectors ?? [];

  if (input.chapterId && !input.documentId) {
    throw new HttpError(400, 'chapterId requires documentId');
  }

  if (input.documentId) await getDocument(input.documentId);

  if (input.quote && selectors.length === 0) {
    if (!input.documentId || !input.chapterId) {
      throw new HttpError(400, 'quote requires documentId and chapterId');
    }

    const { rendered } = await loadChapter(input.documentId, input.chapterId);
    const hit = findQuote(rendered.text, input.quote);

    if (!hit) {
      throw new HttpError(
        422,
        `Quote not found in ${input.documentId}/${input.chapterId}: "${input.quote.slice(0, 80)}"`
      );
    }

    selectors = describeRange(rendered.text, hit.start, hit.end);
  }

  const type = input.type ?? 'highlight';

  const [row] = await getDb()
    .insert(t.annotations)
    .values({
      body: input.body ?? null,
      chapterId: input.chapterId ?? null,
      color: input.color ?? (type === 'highlight' && selectors.length ? 'yellow' : null),
      documentId: input.documentId ?? null,
      id: annotationId(),
      quote: quoteOf(selectors),
      selectors,
      tags: input.tags ?? [],
      type,
    })
    .returning();

  return row;
};

/**
 *
 * @param id
 * @param patch
 */
export const updateAnnotation = async (
  id: string,
  patch: Partial<Pick<AnnotationRow, 'color' | 'body' | 'tags' | 'type' | 'orphaned' | 'selectors'>>
) => {
  const values: Partial<AnnotationRow> = { ...patch };

  if (patch.selectors) values.quote = quoteOf(patch.selectors);

  const [row] = await getDb()
    .update(t.annotations)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(t.annotations.id, id))
    .returning();

  if (!row) notFound(`Annotation ${id}`);

  return row;
};

/**
 *
 * @param id
 */
export const deleteAnnotation = async (id: string) => {
  const res = await getDb()
    .delete(t.annotations)
    .where(eq(t.annotations.id, id))
    .returning({ id: t.annotations.id });

  if (!res.length) notFound(`Annotation ${id}`);
};

// ---- Study sessions ----

/**
 *
 * @param input
 */
export const createSession = async (input: StudySessionInput) => {
  await getDocument(input.documentId);

  const [row] = await getDb()
    .insert(t.studySessions)
    .values({
      chapterId: input.chapterId ?? null,
      documentId: input.documentId,
      followUps: input.followUps,
      kind: input.kind,
      questions: input.questions,
      score: input.score ?? null,
      summary: input.summary ?? null,
    })
    .returning();

  return row;
};

/**
 *
 * @param f
 */
export const listSessions = async (f: {
  chapterId?: string;
  documentId?: string;
  limit?: number;
  since?: Date;
}) => {
  const where: SQL[] = [];

  if (f.documentId) where.push(eq(t.studySessions.documentId, f.documentId));
  if (f.chapterId) where.push(eq(t.studySessions.chapterId, f.chapterId));
  if (f.since) where.push(gte(t.studySessions.createdAt, f.since));

  return getDb()
    .select()
    .from(t.studySessions)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(t.studySessions.createdAt))
    .limit(f.limit ?? 200);
};

// ---- Search ----

/**
 *
 * @param q
 * @param limit
 */
export const search = async (q: string, limit = 40) => {
  const db = getDb();
  const query = sql`websearch_to_tsquery('english', ${q})`;

  const chapters = await db
    .select({
      chapterId: t.chapters.id,
      documentId: t.chapters.documentId,
      documentTitle: t.documents.title,
      rank: sql<number>`ts_rank(${t.chapters.search}, ${query})`,
      snippet: sql<string>`ts_headline('english', ${t.chapters.plainText}, ${query}, 'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=15, MaxFragments=2, FragmentDelimiter= … ')`,
      title: t.chapters.title,
    })
    .from(t.chapters)
    .innerJoin(t.documents, eq(t.documents.id, t.chapters.documentId))
    .where(sql`${t.chapters.search} @@ ${query}`)
    .orderBy(desc(sql`ts_rank(${t.chapters.search}, ${query})`))
    .limit(limit);

  const notes = await db
    .select()
    .from(t.annotations)
    .where(sql`${t.annotations.search} @@ ${query}`)
    .orderBy(desc(sql`ts_rank(${t.annotations.search}, ${query})`))
    .limit(limit);

  const titles = await db
    .select({ id: t.documents.id, title: t.documents.title })
    .from(t.documents)
    .where(sql`${t.documents.title} % ${q} or ${t.documents.title} ilike ${'%' + q + '%'}`)
    .limit(10);

  return {
    chapters,
    documents: titles,
    notes,
  };
};
