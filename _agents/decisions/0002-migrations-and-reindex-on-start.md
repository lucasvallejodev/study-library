# ADR 0002 — Migrations and reindex run on server start

Status: accepted (2026-10-27)

Instead of `drizzle-kit migrate` in the container entrypoint, `apps/web/src/instrumentation.ts` runs drizzle-orm's programmatic migrator, then `reindexLibrary()` (rebuilds `documents`/`chapters` rows from `library/`, removes rows for deleted folders) and re-queues interrupted import jobs. One process, no extra entrypoint script, and the index always matches the folder after a restore or a manual copy. `pnpm db:migrate` exists for running migrations by hand.
