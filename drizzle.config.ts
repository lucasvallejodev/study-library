import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://library:library@localhost:5433/library',
  },
  dialect: 'postgresql',
  out: './packages/core/drizzle',
  schema: './packages/core/src/db/schema.ts',
});
