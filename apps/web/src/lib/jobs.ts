import 'server-only';

import { asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
import { rm } from 'node:fs/promises';

import { importSource, reimportDocument } from '@study/ingest';

import { getDb, t } from './db';

/** An import job as stored in the database. */
export type JobRow = typeof t.importJobs.$inferSelect;

/** What to import: an uploaded file path, a URL, or the id of a document to re-import. */
export type JobInput = {
  input: string;
  inputType: 'file' | 'reimport' | 'url';
  options?: Record<string, unknown>;
  originalName?: string;
};

type JobColumns = typeof t.importJobs.$inferInsert;

type JobUpdate = { [Column in keyof JobColumns]?: JobColumns[Column] | SQL };

const DEFAULT_JOB_LIST_LIMIT = 30;

const queueState = globalThis as unknown as { __studyJobsRunning?: boolean };

const updateJob = async (id: number, values: JobUpdate): Promise<void> => {
  await getDb()
    .update(t.importJobs)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(t.importJobs.id, id));
};

const asLogLine = (line: string): string => `${line}\n`;

const appendLog = async (id: number, line: string): Promise<void> => {
  await updateJob(id, { log: sql`${t.importJobs.log} || ${asLogLine(line)}` });
};

const errorMessage = (error: unknown): string => (error as Error).message;

const importJobSource = async (job: JobRow, log: (message: string) => void): Promise<string> => {
  const db = getDb();

  const result =
    job.inputType === 'reimport'
      ? await reimportDocument(job.input, { db, log })
      : await importSource(job.input, {
          db,
          id: job.options.id as string | undefined,
          log,
          tocDepth: job.options.tocDepth as number | undefined,
        });

  return result.document.id;
};

const runJob = async (job: JobRow): Promise<void> => {
  await updateJob(job.id, { status: 'running' });

  const log = (message: string): void => void appendLog(job.id, message);

  try {
    const documentId = await importJobSource(job, log);

    await updateJob(job.id, { documentId, status: 'done' });
  } catch (error) {
    await appendLog(job.id, `Error: ${errorMessage(error)}`);
    await updateJob(job.id, { error: errorMessage(error), status: 'failed' });
  } finally {
    if (job.inputType === 'file') await rm(job.input, { force: true });
  }
};

const nextQueuedJob = async (): Promise<JobRow | undefined> => {
  const [job] = await getDb()
    .select()
    .from(t.importJobs)
    .where(inArray(t.importJobs.status, ['queued']))
    .orderBy(asc(t.importJobs.createdAt))
    .limit(1);

  return job;
};

/**
 * Processes queued jobs one at a time inside this server process.
 *
 * @remarks
 * Returns immediately when the queue is already being processed; the flag lives on
 * `globalThis` so it survives module reloads in development.
 *
 * @returns Resolves when no queued job is left.
 */
export const runQueue = async (): Promise<void> => {
  if (queueState.__studyJobsRunning) return;

  queueState.__studyJobsRunning = true;

  try {
    for (let job = await nextQueuedJob(); job; job = await nextQueuedJob()) {
      await runJob(job);
    }
  } finally {
    queueState.__studyJobsRunning = false;
  }
};

/**
 * Queues an import and starts the queue in the background.
 *
 * @param input - What to import and the importer options (`id`, `tocDepth`).
 * @returns The queued job.
 */
export const enqueueJob = async (input: JobInput): Promise<JobRow> => {
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
 * Lists the most recent import jobs.
 *
 * @param limit - Maximum number of jobs.
 * @returns The jobs, newest first.
 */
export const listJobs = async (limit = DEFAULT_JOB_LIST_LIMIT): Promise<JobRow[]> =>
  getDb().select().from(t.importJobs).orderBy(desc(t.importJobs.createdAt)).limit(limit);

/**
 * Reads one import job.
 *
 * @param id - Job id.
 * @returns The job, or `undefined` when no job has this id.
 */
export const getJob = async (id: number): Promise<JobRow | undefined> => {
  const [job] = await getDb().select().from(t.importJobs).where(eq(t.importJobs.id, id));

  return job;
};

/**
 * Puts jobs left "running" by a crash or restart back in the queue and starts it.
 *
 * @returns Resolves once the jobs are re-queued; the queue keeps running in the background.
 */
export const recoverJobs = async (): Promise<void> => {
  await getDb()
    .update(t.importJobs)
    .set({ status: 'queued' })
    .where(eq(t.importJobs.status, 'running'));

  void runQueue();
};
