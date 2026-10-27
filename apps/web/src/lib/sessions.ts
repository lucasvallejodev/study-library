import 'server-only';

import { desc, eq, gte } from 'drizzle-orm';

import type { StudySessionInput } from '@study/core';

import { getDb, t } from './db';
import { getDocument } from './documents';
import { type ConditionBuilder, whereAll } from './sql-conditions';

/** A study session as stored in the database. */
export type SessionRow = typeof t.studySessions.$inferSelect;

/** Filters for {@link listSessions}; they combine with `and`. */
export type SessionFilter = {
  chapterId?: string;
  documentId?: string;
  limit?: number;
  since?: Date;
};

const DEFAULT_SESSION_LIMIT = 200;

const SessionConditions: ConditionBuilder<SessionFilter>[] = [
  ({ documentId }) => (documentId ? eq(t.studySessions.documentId, documentId) : undefined),
  ({ chapterId }) => (chapterId ? eq(t.studySessions.chapterId, chapterId) : undefined),
  ({ since }) => (since ? gte(t.studySessions.createdAt, since) : undefined),
];

/**
 * Saves a study session (questions, answers, score) for a document.
 *
 * @param input - The session as accepted by `StudySessionInputSchema`.
 * @returns The stored row.
 * @throws {@link HttpError} 404 when the document does not exist.
 */
export const createSession = async (input: StudySessionInput): Promise<SessionRow> => {
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
 * Lists study sessions matching a filter.
 *
 * @param filter - Document, chapter, `since` and `limit` (default 200).
 * @returns The matching sessions, newest first.
 */
export const listSessions = async (filter: SessionFilter): Promise<SessionRow[]> =>
  getDb()
    .select()
    .from(t.studySessions)
    .where(whereAll(SessionConditions, filter))
    .orderBy(desc(t.studySessions.createdAt))
    .limit(filter.limit ?? DEFAULT_SESSION_LIMIT);
