# Architecture overview

```
          ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐
          │ Web upload   │   │ lib CLI      │   │ Claude Code skills   │
          │ /import      │   │ (HTTP only)  │   │ (call the lib CLI)   │
          └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘
                 │  POST /api/import (job)  ◄──────────────┘
                 ▼
     apps/web  (Next.js 16: pages + /api routes + in-process job queue)
                 │ importSource()                 │ reader / notebook / search
                 ▼                                ▼
     packages/ingest ──► library/<doc>/ (Markdown, assets, document.json)
                 │                                ▲  read at request time
                 └── indexDocument() ──► PostgreSQL (index + annotations + sessions + jobs)
```

## Packages

- `@study/core` — the contract. Zod schemas for `document.json`, chapter frontmatter, annotations, selectors, study sessions and the import report; library path helpers (`libraryDir`, `documentDir`, `resolveInDocument`); Drizzle schema and migrations; `indexDocument`/`reindexLibrary`. Imported as source (no build step): `"main": "src/index.ts"`, Next transpiles it.
- `@study/ingest` — `importSource(input, opts)` dispatches by input type; `reimportDocument(id)` re-runs from `source/`. All importers end in `writeLibraryDocument()`, which builds the folder in `library/.build-*` and swaps it in atomically.
- `@study/anchoring` — pure text functions (`describeRange`, `resolveSelectors`, `findQuote`) used on both server and client, plus DOM helpers (`rangeFromOffsets`, `offsetsFromRange`).
- `@study/cli` — `lib` command. HTTP client for the API only (so it works from a laptop against the home server).
- `apps/web` — server components read `library/` directly; client components call `/api/*`. `src/instrumentation.ts` runs migrations, reindexes `library/` and resumes queued jobs at start.

## Runtime facts

- Chapter HTML is rendered on the server by unified (remark → rehype → sanitize → KaTeX → Shiki) and cached in memory by `contentHash`.
- The "text" of a chapter for anchoring = concatenation of all text nodes of the rendered HTML. The server computes it from the hast tree (`renderChapter().text`) so CLI/AI-created annotations (`--quote`) get the same offsets as browser-created ones.
- Import jobs run one at a time inside the Next.js server process (`runQueue`). Uploads land in `_temp/uploads/` and are deleted after the job.
- Assets are served by `/api/assets/<doc>/assets/<hash>.<ext>` with immutable caching; Markdown keeps relative `../assets/…` links so chapter files are readable in any Markdown viewer.
