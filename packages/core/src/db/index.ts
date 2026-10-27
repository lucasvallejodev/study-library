import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { ignoreNotice } from './notices';
import * as schema from './schema';

export * as schema from './schema';
/** Drizzle database bound to the library schema. */
export type Db = PostgresJsDatabase<typeof schema>;

const POOL_SIZE = 10;
const DEFAULT_DATABASE_URL = 'postgres://library:library@localhost:5433/library';

const globalForDb = globalThis as unknown as { __studyDb?: { client: postgres.Sql; db: Db } };

/**
 * Reads the Postgres connection string.
 *
 * @returns `DATABASE_URL`, or the local Docker database from `pnpm db:up`.
 */
export const databaseUrl = (): string => process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

/**
 * Returns the shared database handle, opening the pool on first use.
 *
 * @remarks
 * One pool per process, kept on `globalThis` so it survives Next.js dev hot reloads.
 *
 * @returns The Drizzle database.
 */
export const getDb = (): Db => {
  if (!globalForDb.__studyDb) {
    const client = postgres(databaseUrl(), { max: POOL_SIZE, onnotice: ignoreNotice });

    globalForDb.__studyDb = { client, db: drizzle(client, { schema }) };
  }

  return globalForDb.__studyDb.db;
};

/**
 * Closes the shared pool, if open, so the process can exit.
 *
 * @returns Resolves once every connection is closed.
 */
export const closeDb = async (): Promise<void> => {
  if (globalForDb.__studyDb) {
    await globalForDb.__studyDb.client.end();
    globalForDb.__studyDb = undefined;
  }
};

export { migrateDatabase } from './migrate';
export * from './indexer';
