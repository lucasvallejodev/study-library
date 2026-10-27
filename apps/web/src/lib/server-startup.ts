import 'server-only';

import { getDb, migrateDatabase, reindexLibrary } from '@study/core/db';

import { recoverJobs } from './jobs';

const LOG_PREFIX = '[study-library]';

const startupSummary = (indexed: string[], removed: string[]): string => {
  const removedPart = removed.length ? `, removed ${removed.length}` : '';

  return `${LOG_PREFIX} DB ready; indexed ${indexed.length} documents${removedPart}`;
};

/**
 * Prepares the Node.js server once at start: applies migrations, syncs the index with
 * `library/` and resumes interrupted import jobs.
 *
 * @remarks
 * Failures are logged, not thrown, so the reader still starts when the database is down.
 *
 * @returns Resolves when the startup work is finished.
 */
export const prepareServer = async (): Promise<void> => {
  try {
    await migrateDatabase();

    const { indexed, removed } = await reindexLibrary(getDb());

    console.log(startupSummary(indexed, removed));
    await recoverJobs();
  } catch (error) {
    console.error(`${LOG_PREFIX} startup failed:`, error);
  }
};
