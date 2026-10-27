import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export * as schema from './schema';
export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __studyDb?: { client: postgres.Sql; db: Db } };

/**
 *
 */
export const databaseUrl = (): string =>
  process.env.DATABASE_URL ?? 'postgres://library:library@localhost:5433/library';

/** One shared pool per process (survives Next.js dev hot reloads). */
export const getDb = (): Db => {
  if (!globalForDb.__studyDb) {
    const client = postgres(databaseUrl(), { max: 10, onnotice: () => {} });

    globalForDb.__studyDb = { client, db: drizzle(client, { schema }) };
  }

  return globalForDb.__studyDb.db;
};

/**
 *
 */
export const closeDb = async (): Promise<void> => {
  if (globalForDb.__studyDb) {
    await globalForDb.__studyDb.client.end();
    globalForDb.__studyDb = undefined;
  }
};

export { migrateDatabase } from './migrate';
export * from './indexer';
