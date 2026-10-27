import 'server-only';

import { desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';

import { describeRange, findQuote } from '@study/anchoring';
import { type Annotation, annotationId, type NewAnnotation, type Selector } from '@study/core';

import { getDb, t } from './db';
import { getDocument, loadChapter } from './documents';
import { HttpError, HttpStatus, notFound } from './http';
import { type ConditionBuilder, whereAll } from './sql-conditions';

/** An annotation as stored in the database. */
export type AnnotationRow = typeof t.annotations.$inferSelect;

/** Filters for {@link listAnnotations}; every field is optional and they combine with `and`. */
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

/** Fields of an annotation that {@link updateAnnotation} may change. */
export type AnnotationPatch = Partial<
  Pick<AnnotationRow, 'body' | 'color' | 'orphaned' | 'selectors' | 'tags' | 'type'>
>;

const DEFAULT_ANNOTATION_LIMIT = 1000;
const QUOTE_PREVIEW_LENGTH = 80;
const DEFAULT_HIGHLIGHT_COLOR = 'yellow';
const TYPE_LIST_SEPARATOR = ',';

/**
 * Converts a database row into the API's annotation shape.
 *
 * @param row - The stored annotation.
 * @returns The annotation with ISO timestamps.
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

const AnnotationConditions: ConditionBuilder<AnnotationFilter>[] = [
  ({ documentId }) => (documentId ? eq(t.annotations.documentId, documentId) : undefined),
  ({ chapterId }) => (chapterId ? eq(t.annotations.chapterId, chapterId) : undefined),
  ({ type }) => (type ? inArray(t.annotations.type, type.split(TYPE_LIST_SEPARATOR)) : undefined),
  ({ color }) => (color ? eq(t.annotations.color, color) : undefined),
  ({ tag }) => (tag ? sql`${t.annotations.tags} ? ${tag}` : undefined),
  ({ since }) => (since ? gte(t.annotations.updatedAt, since) : undefined),
  ({ free }) => (free ? isNull(t.annotations.documentId) : undefined),
  ({ q: text }) =>
    text ? sql`${t.annotations.search} @@ websearch_to_tsquery('english', ${text})` : undefined,
];

/**
 * Lists annotations matching a filter.
 *
 * @param filter - Document, chapter, comma-separated types, color, tag, `since`, free notes only
 * (`free`, no document), full-text query `q` and `limit` (default 1000).
 * @returns The matching rows, newest first.
 */
export const listAnnotations = async (filter: AnnotationFilter = {}): Promise<AnnotationRow[]> =>
  getDb()
    .select()
    .from(t.annotations)
    .where(whereAll(AnnotationConditions, filter))
    .orderBy(desc(t.annotations.createdAt))
    .limit(filter.limit ?? DEFAULT_ANNOTATION_LIMIT);

/**
 * Reads one annotation.
 *
 * @param id - Annotation id (`a-xxxxxx`).
 * @returns The stored row.
 * @throws {@link HttpError} 404 when no annotation has this id.
 */
export const getAnnotation = async (id: string): Promise<AnnotationRow> => {
  const [row] = await getDb().select().from(t.annotations).where(eq(t.annotations.id, id));

  if (!row) notFound(`Annotation ${id}`);

  return row;
};

const quoteOf = (selectors: Selector[]): string | null => {
  const quoteSelector = selectors.find(selector => selector.type === 'TextQuoteSelector');

  return quoteSelector?.type === 'TextQuoteSelector' ? quoteSelector.exact : null;
};

const assertValidTarget = async (input: NewAnnotation): Promise<void> => {
  if (input.chapterId && !input.documentId) {
    throw new HttpError(HttpStatus.badRequest, 'chapterId requires documentId');
  }

  if (input.documentId) await getDocument(input.documentId);
};

const selectorsForQuote = async (
  documentId: NewAnnotation['documentId'],
  chapterId: NewAnnotation['chapterId'],
  quote: string
): Promise<Selector[]> => {
  if (!documentId || !chapterId) {
    throw new HttpError(HttpStatus.badRequest, 'quote requires documentId and chapterId');
  }

  const { rendered } = await loadChapter(documentId, chapterId);
  const hit = findQuote(rendered.text, quote);

  if (!hit) {
    throw new HttpError(
      HttpStatus.unprocessableContent,
      `Quote not found in ${documentId}/${chapterId}: "${quote.slice(0, QUOTE_PREVIEW_LENGTH)}"`
    );
  }

  return describeRange(rendered.text, hit.start, hit.end);
};

const resolveNewSelectors = async (input: NewAnnotation): Promise<Selector[]> => {
  const selectors = input.selectors ?? [];

  if (!input.quote || selectors.length > 0) return selectors;

  return selectorsForQuote(input.documentId, input.chapterId, input.quote);
};

const defaultColor = (type: string, selectors: Selector[]): string | null =>
  type === 'highlight' && selectors.length ? DEFAULT_HIGHLIGHT_COLOR : null;

/**
 * Creates an annotation, anchoring it from a `quote` when no selectors are given.
 *
 * @remarks
 * The reader sends selectors; the CLI and AI tools send the quoted text, which is searched in
 * the rendered chapter. Highlights with selectors default to yellow.
 *
 * @param input - The new annotation as accepted by `NewAnnotationSchema`.
 * @returns The stored row.
 * @throws {@link HttpError} 400 when `chapterId` comes without `documentId` or a quote without
 * both, 404 when the document or chapter does not exist, 422 when the quote is not found.
 */
export const createAnnotation = async (input: NewAnnotation): Promise<AnnotationRow> => {
  await assertValidTarget(input);

  const selectors = await resolveNewSelectors(input);
  const type = input.type ?? 'highlight';

  const [row] = await getDb()
    .insert(t.annotations)
    .values({
      body: input.body ?? null,
      chapterId: input.chapterId ?? null,
      color: input.color ?? defaultColor(type, selectors),
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
 * Changes fields of an annotation and refreshes its stored quote when the selectors change.
 *
 * @param id - Annotation id.
 * @param patch - Fields to change.
 * @returns The updated row.
 * @throws {@link HttpError} 404 when no annotation has this id.
 */
export const updateAnnotation = async (
  id: string,
  patch: AnnotationPatch
): Promise<AnnotationRow> => {
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
 * Deletes an annotation.
 *
 * @param id - Annotation id.
 * @returns Resolves once the row is gone.
 * @throws {@link HttpError} 404 when no annotation has this id.
 */
export const deleteAnnotation = async (id: string): Promise<void> => {
  const deleted = await getDb()
    .delete(t.annotations)
    .where(eq(t.annotations.id, id))
    .returning({ id: t.annotations.id });

  if (!deleted.length) notFound(`Annotation ${id}`);
};

/** A tag in use and how many annotations carry it. */
export type TagUsage = {
  count: number;
  tag: string;
};

/**
 * Lists every tag used on any annotation, most used first.
 *
 * @returns One entry per distinct tag, ordered by usage and then alphabetically.
 */
export const listTags = async (): Promise<TagUsage[]> => {
  const usage = sql<number>`count(*)::int`;
  const tag = sql<string>`jsonb_array_elements_text(${t.annotations.tags})`;

  const rows = await getDb()
    .select({ count: usage, tag })
    .from(t.annotations)
    .groupBy(sql`2`)
    .orderBy(desc(usage), sql`2`);

  return rows;
};
