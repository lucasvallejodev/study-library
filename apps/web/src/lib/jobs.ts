import "server-only";
import { rm } from "node:fs/promises";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { importSource, reimportDocument } from "@study/ingest";
import { getDb, t } from "./db";

export type JobRow = typeof t.importJobs.$inferSelect;

const state = globalThis as unknown as { __studyJobsRunning?: boolean };

export async function enqueueJob(input: { inputType: "file" | "url" | "reimport"; input: string; originalName?: string; options?: Record<string, unknown> }) {
  const [job] = await getDb()
    .insert(t.importJobs)
    .values({ inputType: input.inputType, input: input.input, originalName: input.originalName ?? null, options: input.options ?? {} })
    .returning();
  void runQueue();
  return job!;
}

export async function listJobs(limit = 30) {
  return getDb().select().from(t.importJobs).orderBy(desc(t.importJobs.createdAt)).limit(limit);
}

export async function getJob(id: number) {
  const [job] = await getDb().select().from(t.importJobs).where(eq(t.importJobs.id, id));
  return job;
}

async function appendLog(id: number, line: string) {
  await getDb()
    .update(t.importJobs)
    .set({ log: sql`${t.importJobs.log} || ${line + "\n"}`, updatedAt: sql`now()` })
    .where(eq(t.importJobs.id, id));
}

/** Jobs left "running" by a crash or restart go back to the queue. */
export async function recoverJobs() {
  await getDb().update(t.importJobs).set({ status: "queued" }).where(eq(t.importJobs.status, "running"));
  void runQueue();
}

/** Process queued jobs one at a time inside this server process. */
export async function runQueue(): Promise<void> {
  if (state.__studyJobsRunning) return;
  state.__studyJobsRunning = true;
  try {
    while (true) {
      const [job] = await getDb()
        .select()
        .from(t.importJobs)
        .where(inArray(t.importJobs.status, ["queued"]))
        .orderBy(asc(t.importJobs.createdAt))
        .limit(1);
      if (!job) break;
      await runJob(job);
    }
  } finally {
    state.__studyJobsRunning = false;
  }
}

async function runJob(job: JobRow) {
  const db = getDb();
  await db.update(t.importJobs).set({ status: "running", updatedAt: sql`now()` }).where(eq(t.importJobs.id, job.id));
  const log = (m: string) => void appendLog(job.id, m);
  try {
    const opts = { db, log, id: job.options.id as string | undefined, tocDepth: job.options.tocDepth as number | undefined };
    const result =
      job.inputType === "reimport" ? await reimportDocument(job.input, { db, log }) : await importSource(job.input, opts);
    await db
      .update(t.importJobs)
      .set({ status: "done", documentId: result.document.id, updatedAt: sql`now()` })
      .where(eq(t.importJobs.id, job.id));
  } catch (e) {
    await appendLog(job.id, `Error: ${(e as Error).message}`);
    await db
      .update(t.importJobs)
      .set({ status: "failed", error: (e as Error).message, updatedAt: sql`now()` })
      .where(eq(t.importJobs.id, job.id));
  } finally {
    if (job.inputType === "file") await rm(job.input, { force: true });
  }
}
