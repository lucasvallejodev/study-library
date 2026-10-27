import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { findRepoRoot } from "../library";
import { databaseUrl } from "./index";

/** Apply pending migrations from packages/core/drizzle. Safe to run on every start. */
export async function migrateDatabase(migrationsFolder = defaultMigrationsFolder()): Promise<void> {
  const client = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

function defaultMigrationsFolder(): string {
  return process.env.MIGRATIONS_DIR ?? path.join(findRepoRoot(), "packages/core/drizzle");
}
