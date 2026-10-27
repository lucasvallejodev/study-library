# ADR 0004 — Next.js 16 and workspace packages without a build step

Status: accepted (2026-10-27)

Next.js 16 (Turbopack) is the current major. Workspace packages export TypeScript source (`main: src/index.ts`) and Next transpiles them (`transpilePackages`); the CLI and tests run them through `tsx`/`vitest`. Node-only ingestion dependencies (jsdom, defuddle, postgres, jszip) are `serverExternalPackages`. No `dist/` to keep in sync, at the cost of shipping source to the Docker image (fine for a private server).
