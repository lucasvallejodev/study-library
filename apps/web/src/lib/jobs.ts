import 'server-only';

import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { rm } from 'node:fs/promises';

import { importSource, reimportDocument } from '@study/ingest';

import { getDb, t } from './db';

export type JobRow = typeof t.importJobs.$inferSelect;

const state = globalThis as unknown as { __studyJobsRunning?: boolean };

/**
 *
 * @param input
 */
export const enqueueJob = async (input: {
  input: string;
  inputType: 'file' | 'url' | 'reimport';
  options?: Record<string, unknown>;
  originalName?: string;
}) => {
  const [job] = await getDb()
    .insert(t.importJobs)
    .values({
      input: input.input,
      inputType: input.inputType,
      options: input.options ?? {},
      originalName: input.originalName ?? null,
    })
    .returning();

  void runQueue();

  return job;
};

/**
 *
 * @param limit
 */
export const listJobs = async (limit = 30) =>
  getDb().select().from(t.importJobs).orderBy(desc(t.importJobs.createdAt)).limit(limit);

/**
 *
 * @param id
 */
export const getJob = async (id: number) => {
  const [job] = await getDb().select().from(t.importJobs).where(eq(t.importJobs.id, id));

  return job;
};

const appendLog = async (id: number, line: string) => {
  await getDb()
    .update(t.importJobs)
    .set({ log: sql`${t.importJobs.log} || ${line + '\n'}`, updatedAt: sql`now()` })
    .where(eq(t.importJobs.id, id));
};

/** Jobs left "running" by a crash or restart go back to the queue. */
export const recoverJobs = async () => {
  await getDb()
    .update(t.importJobs)
    .set({ status: 'queued' })
    .where(eq(t.importJobs.status, 'running'));
  void runQueue();
};

/** Process queued jobs one at a time inside this server process. */
export const runQueue = async (): Promise<void> => {
  if (state.__studyJobsRunning) return;
  state.__studyJobsRunning = true;

  try {
    while (true) {
      const [job] = await getDb()
        .select()
        .from(t.importJobs)
        .where(inArray(t.importJobs.status, ['queued']))
        .orderBy(asc(t.importJobs.createdAt))
        .limit(1);

      if (!job) break;
      await runJob(job);
    }
  } finally {
    state.__studyJobsRunning = false;
  }
};

const runJob = async (job: JobRow) => {
  const db = getDb();

  await db
    .update(t.importJobs)
    .set({ status: 'running', updatedAt: sql`now()` })
    .where(eq(t.importJobs.id, job.id));
  const log = (m: string) => void appendLog(job.id, m);

  try {
    const opts = {
      db,
      id: job.options.id as string | undefined,
      log,
      tocDepth: job.options.tocDepth as number | undefined,
    };

    const result =
      job.inputType === 'reimport'
        ? await reimportDocument(job.input, { db, log })
        : await importSource(job.input, opts);

    await db
      .update(t.importJobs)
      .set({
        documentId: result.document.id,
        status: 'done',
        updatedAt: sql`now()`,
      })
      .where(eq(t.importJobs.id, job.id));
  } catch (e) {
    await appendLog(job.id, `Error: ${(e as Error).message}`);
    await db
      .update(t.importJobs)
      .set({
        error: (e as Error).message,
        status: 'failed',
        updatedAt: sql`now()`,
      })
      .where(eq(t.importJobs.id, job.id));
  } finally {
    if (job.inputType === 'file') await rm(job.input, { force: true });
  }
};
