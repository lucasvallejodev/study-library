import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/core/src/db/schema.ts",
  out: "./packages/core/drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://library:library@localhost:5433/library" },
});
