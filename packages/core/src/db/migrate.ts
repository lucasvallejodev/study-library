import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import postgres from 'postgres';

import { findRepoRoot } from '../library';
import { databaseUrl } from './index';
import { ignoreNotice } from './notices';

const MIGRATION_CONNECTIONS = 1;

const defaultMigrationsFolder = (): string =>
  process.env.MIGRATIONS_DIR ?? path.join(findRepoRoot(), 'packages/core/drizzle');

/**
 * Applies pending migrations. Safe to run on every start.
 *
 * @param migrationsFolder - Folder of Drizzle migrations; defaults to `MIGRATIONS_DIR` or
 * `packages/core/drizzle`.
 * @returns Resolves once the migrations are applied and the connection is closed.
 * @throws Error when the database is unreachable or a migration fails.
 */
export const migrateDatabase = async (
  migrationsFolder = defaultMigrationsFolder()
): Promise<void> => {
  const client = postgres(databaseUrl(), { max: MIGRATION_CONNECTIONS, onnotice: ignoreNotice });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
};
