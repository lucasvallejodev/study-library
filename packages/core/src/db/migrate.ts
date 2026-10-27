import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import postgres from 'postgres';

import { findRepoRoot } from '../library';
import { databaseUrl } from './index';

/**
 * Apply pending migrations from packages/core/drizzle. Safe to run on every start.
 *
 * @param migrationsFolder
 */
export const migrateDatabase = async (
  migrationsFolder = defaultMigrationsFolder()
): Promise<void> => {
  const client = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
};

const defaultMigrationsFolder = (): string =>
  process.env.MIGRATIONS_DIR ?? path.join(findRepoRoot(), 'packages/core/drizzle');
