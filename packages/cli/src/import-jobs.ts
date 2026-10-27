import type { ImportJob, ImportWarning } from './api-types';
import { API_URL, request } from './client';

type ImportSummary = {
  chapters: number | undefined;
  documentId: string | null;
  url: string;
  warnings: ImportWarning[];
  words: number | undefined;
};

const JOB_POLL_INTERVAL_MS = 700;
const FinishedJobStatuses = new Set(['done', 'failed']);

const pause = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export const waitForJob = async (id: number, quiet = false): Promise<ImportJob> => {
  let printedLength = 0;

  while (true) {
    const job = await request<ImportJob>(`/api/import/jobs/${id}`);

    if (!quiet && job.log.length > printedLength) {
      process.stderr.write(job.log.slice(printedLength));
      printedLength = job.log.length;
    }

    if (FinishedJobStatuses.has(job.status)) return job;
    await pause(JOB_POLL_INTERVAL_MS);
  }
};

export const summariseJob = (job: ImportJob): ImportSummary => {
  if (job.status === 'failed') throw new Error(job.error ?? 'Import failed');
  const { report } = job;

  return {
    chapters: report?.chapterCount,
    documentId: job.documentId,
    url: `${API_URL}/read/${job.documentId}`,
    warnings: report?.warnings ?? [],
    words: report?.totalWords,
  };
};
