import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { describeRange, findQuote } from "@study/anchoring";
import {
  annotationId,
  documentExists,
  listDocumentIds,
  readChapterBody,
  readDocument,
  type Annotation,
  type LibraryDocument,
  type NewAnnotation,
  type StudySessionInput,
} from "@study/core";
import { getDb, t } from "./db";
import { HttpError, notFound } from "./http";
import { renderChapter } from "./render";

export type AnnotationRow = typeof t.annotations.$inferSelect;

export function toAnnotation(row: AnnotationRow): Annotation {
  return {
    id: row.id,
    documentId: row.documentId,
    chapterId: row.chapterId,
    type: row.type as Annotation["type"],
    color: (row.color as Annotation["color"]) ?? null,
    selectors: row.selectors,
    body: row.body,
    tags: row.tags,
    orphaned: row.orphaned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getDocument(docId: string): Promise<LibraryDocument> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(docId) || !documentExists(docId)) notFound(`Document ${docId}`);
  return readDocument(docId);
}

export async function loadChapter(docId: string, chapterId: string) {
  const doc = await getDocument(docId);
  const index = doc.chapters.findIndex((c) => c.id === chapterId);
  if (index < 0) notFound(`Chapter ${chapterId}`);
  const chapter = doc.chapters[index]!;
  const markdown = await readChapterBody(docId, chapter);
  const rendered = await renderChapter(docId, markdown, chapter.contentHash);
  return { doc, chapter, index, markdown, rendered, prev: doc.chapters[index - 1], next: doc.chapters[index + 1] };
}

// ---- Library overview ----

export type LibraryCard = {
  doc: LibraryDocument;
  percent: number;
  lastRead?: Date;
  lastChapterId?: string;
  annotationCount: number;
};

export async function listLibrary(): Promise<LibraryCard[]> {
  const db = getDb();
  const ids = await listDocumentIds();
  const docs = (await Promise.all(ids.map((id) => readDocument(id).catch(() => undefined)))).filter((d): d is LibraryDocument => !!d);
  const progress = await db.select().from(t.readingProgress);
  const counts = await db
    .select({ documentId: t.annotations.documentId, n: sql<number>`count(*)::int` })
    .from(t.annotations)
    .groupBy(t.annotations.documentId);
  return docs
    .map((doc) => {
      const rows = progress.filter((p) => p.documentId === doc.id);
      const last = rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
      return {
        doc,
        percent: documentPercent(doc, rows),
        lastRead: last?.updatedAt,
        lastChapterId: last?.chapterId,
        annotationCount: counts.find((c) => c.documentId === doc.id)?.n ?? 0,
      };
    })
    .sort((a, b) => (b.lastRead?.getTime() ?? 0) - (a.lastRead?.getTime() ?? 0) || a.doc.title.localeCompare(b.doc.title));
}

/** Share of body-matter words read, weighting each chapter's progress by its length. */
export function documentPercent(doc: LibraryDocument, rows: { chapterId: string; percent: number }[]): number {
  const body = doc.chapters.filter((c) => c.matter === "body");
  const total = body.reduce((n, c) => n + c.wordCount, 0) || 1;
  const read = body.reduce((n, c) => n + c.wordCount * (rows.find((r) => r.chapterId === c.id)?.percent ?? 0), 0);
  return Math.min(1, read / total);
}

export async function documentProgress(docId: string) {
  return getDb().select().from(t.readingProgress).where(eq(t.readingProgress.documentId, docId));
}

export async function saveProgress(documentId: string, chapterId: string, position: number) {
  const pos = Math.max(0, Math.min(1, position));
  const percent = pos > 0.97 ? 1 : pos;
  await getDb()
    .insert(t.readingProgress)
    .values({ documentId, chapterId, position: pos, percent })
    .onConflictDoUpdate({
      target: [t.readingProgress.documentId, t.readingProgress.chapterId],
      // Never lose "finished": percent only moves forward, position follows the reader.
      set: { position: pos, percent: sql`greatest(${t.readingProgress.percent}, ${percent})`, updatedAt: sql`now()` },
    });
}

// ---- Annotations ----

export type AnnotationFilter = {
  documentId?: string;
  chapterId?: string;
  type?: string;
  color?: string;
  tag?: string;
  since?: Date;
  q?: string;
  free?: boolean;
  limit?: number;
};

export async function listAnnotations(f: AnnotationFilter = {}): Promise<AnnotationRow[]> {
  const where: SQL[] = [];
  if (f.documentId) where.push(eq(t.annotations.documentId, f.documentId));
  if (f.chapterId) where.push(eq(t.annotations.chapterId, f.chapterId));
  if (f.type) where.push(inArray(t.annotations.type, f.type.split(",")));
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
}

export async function getAnnotation(id: string): Promise<AnnotationRow> {
  const [row] = await getDb().select().from(t.annotations).where(eq(t.annotations.id, id));
  if (!row) notFound(`Annotation ${id}`);
  return row;
}

function quoteOf(selectors: AnnotationRow["selectors"]): string | null {
  const q = selectors.find((s) => s.type === "TextQuoteSelector");
  return q && q.type === "TextQuoteSelector" ? q.exact : null;
}

export async function createAnnotation(input: NewAnnotation): Promise<AnnotationRow> {
  let selectors = input.selectors ?? [];
  if (input.chapterId && !input.documentId) throw new HttpError(400, "chapterId requires documentId");
  if (input.documentId) await getDocument(input.documentId);
  if (input.quote && selectors.length === 0) {
    if (!input.documentId || !input.chapterId) throw new HttpError(400, "quote requires documentId and chapterId");
    const { rendered } = await loadChapter(input.documentId, input.chapterId);
    const hit = findQuote(rendered.text, input.quote);
    if (!hit) throw new HttpError(422, `Quote not found in ${input.documentId}/${input.chapterId}: "${input.quote.slice(0, 80)}"`);
    selectors = describeRange(rendered.text, hit.start, hit.end);
  }
  const type = input.type ?? "highlight";
  const [row] = await getDb()
    .insert(t.annotations)
    .values({
      id: annotationId(),
      documentId: input.documentId ?? null,
      chapterId: input.chapterId ?? null,
      type,
      color: input.color ?? (type === "highlight" && selectors.length ? "yellow" : null),
      selectors,
      quote: quoteOf(selectors),
      body: input.body ?? null,
      tags: input.tags ?? [],
    })
    .returning();
  return row!;
}

export async function updateAnnotation(id: string, patch: Partial<Pick<AnnotationRow, "color" | "body" | "tags" | "type" | "orphaned" | "selectors">>) {
  const values: Partial<AnnotationRow> = { ...patch };
  if (patch.selectors) values.quote = quoteOf(patch.selectors);
  const [row] = await getDb()
    .update(t.annotations)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(t.annotations.id, id))
    .returning();
  if (!row) notFound(`Annotation ${id}`);
  return row;
}

export async function deleteAnnotation(id: string) {
  const res = await getDb().delete(t.annotations).where(eq(t.annotations.id, id)).returning({ id: t.annotations.id });
  if (!res.length) notFound(`Annotation ${id}`);
}

// ---- Study sessions ----

export async function createSession(input: StudySessionInput) {
  await getDocument(input.documentId);
  const [row] = await getDb()
    .insert(t.studySessions)
    .values({
      documentId: input.documentId,
      chapterId: input.chapterId ?? null,
      kind: input.kind,
      questions: input.questions,
      score: input.score ?? null,
      summary: input.summary ?? null,
      followUps: input.followUps,
    })
    .returning();
  return row!;
}

export async function listSessions(f: { documentId?: string; chapterId?: string; since?: Date; limit?: number }) {
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
}

// ---- Search ----

export async function search(q: string, limit = 40) {
  const db = getDb();
  const query = sql`websearch_to_tsquery('english', ${q})`;
  const chapters = await db
    .select({
      documentId: t.chapters.documentId,
      chapterId: t.chapters.id,
      title: t.chapters.title,
      documentTitle: t.documents.title,
      rank: sql<number>`ts_rank(${t.chapters.search}, ${query})`,
      snippet: sql<string>`ts_headline('english', ${t.chapters.plainText}, ${query}, 'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=15, MaxFragments=2, FragmentDelimiter= … ')`,
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
    .where(sql`${t.documents.title} % ${q} or ${t.documents.title} ilike ${"%" + q + "%"}`)
    .limit(10);
  return { chapters, notes, documents: titles };
}
