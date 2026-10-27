import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { getDb, t } from './db';

/** One chapter's reading progress as stored in the database. */
export type ProgressRow = typeof t.readingProgress.$inferSelect;

const FINISHED_POSITION = 0.97;

const clampToUnit = (value: number): number => Math.max(0, Math.min(1, value));

const percentForPosition = (position: number): number =>
  position > FINISHED_POSITION ? 1 : position;

const neverDecreasingPercent = (percent: number): ReturnType<typeof sql> =>
  sql`greatest(${t.readingProgress.percent}, ${percent})`;

/**
 * Reads where the reader left a chapter, to restore the scroll position.
 *
 * @param docId - Document slug.
 * @param chapterId - Chapter id within the document.
 * @returns Last scroll position through the chapter (0 to 1), or 0 when never opened.
 */
export const savedChapterPosition = async (docId: string, chapterId: string): Promise<number> => {
  const [progress] = await getDb()
    .select()
    .from(t.readingProgress)
    .where(
      and(eq(t.readingProgress.documentId, docId), eq(t.readingProgress.chapterId, chapterId))
    );

  return progress?.position ?? 0;
};

/**
 * Lists the reading progress of every chapter of a document.
 *
 * @param docId - Document slug.
 * @returns One row per chapter the reader has opened.
 */
export const documentProgress = async (docId: string): Promise<ProgressRow[]> =>
  getDb().select().from(t.readingProgress).where(eq(t.readingProgress.documentId, docId));

/**
 * Records where the reader is in a chapter.
 *
 * @remarks
 * The position is clamped to 0–1 and anything past 97 % counts as finished. The stored percent
 * only moves forward, so scrolling back never loses "finished"; the position follows the reader.
 *
 * @param documentId - Document slug.
 * @param chapterId - Chapter id.
 * @param position - Scroll position as a fraction of the chapter (0–1).
 * @returns Resolves once the row is upserted.
 */
export const saveProgress = async (
  documentId: string,
  chapterId: string,
  position: number
): Promise<void> => {
  const clampedPosition = clampToUnit(position);
  const percent = percentForPosition(clampedPosition);

  await getDb()
    .insert(t.readingProgress)
    .values({
      chapterId,
      documentId,
      percent,
      position: clampedPosition,
    })
    .onConflictDoUpdate({
      set: {
        percent: neverDecreasingPercent(percent),
        position: clampedPosition,
        updatedAt: sql`now()`,
      },
      target: [t.readingProgress.documentId, t.readingProgress.chapterId],
    });
};
