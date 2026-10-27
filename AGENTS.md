# AGENTS.md — Study Library

A local, single-user study library. One ingestion pipeline turns EPUB, MOBI/AZW, web pages and Markdown into chapter-split Markdown on disk; a Medium-style reader lets you highlight and annotate; Claude Code reads the same files (through the `lib` CLI) to quiz you.

**Core rule: content lives as plain Markdown files in `library/`, annotations live in PostgreSQL.** The DB index of documents/chapters is rebuildable from disk at any time; annotations and study sessions are not (back them up with `pnpm -s lib export`).

Read `_agents/README.md` for the full knowledge base before larger changes.

## Repository map

```
apps/web/            Next.js 16 (App Router) reader + HTTP API (src/app/api/*) + import job queue
packages/core/       THE CONTRACT: Zod schemas (document.json, frontmatter, annotations, selectors),
                     library path helpers, Drizzle schema + migrations (packages/core/drizzle), indexer
packages/ingest/     Importers: epub-*.ts (EPUB), calibre.ts (MOBI/AZW), url.ts (Defuddle), markdown.ts, writer.ts
packages/anchoring/  W3C TextQuote/TextPosition selectors, fuzzy re-anchoring, DOM range helpers
packages/cli/        `lib` command; talks ONLY to the web app's HTTP API (LIB_API_URL)
.claude/skills/      Claude Code skills (import-source, study, review, study-notes, highlight-notes, pdf-to-library, verify-mvp)
_agents/             Docs for agents: product plan, architecture, contracts, runbooks, decisions, conventions
fixtures/            Offline test inputs (saved HTML pages, images, Markdown)
library/             Real content (git-ignored, one folder per document)
_temp/               Scratch space for you and the user (git-ignored except .gitkeep)
```

## Commands

```bash
pnpm install                 # Node 22+, pnpm 10 (corepack enable)
pnpm db:up                   # Postgres 18 in Docker on 127.0.0.1:5433
pnpm dev                     # web app on http://localhost:3000 (runs migrations + reindex on start)
pnpm test                    # vitest: anchoring, generated EPUB, html fixtures, markdown, drm
pnpm typecheck               # tsc in every package
pnpm lint                    # ESLint (Prettier, style, naming, TSDoc, complexity rules); 0 errors, 0 warnings
pnpm lint:fix                # apply Prettier, blank lines, sorting and every other automatic fix
pnpm lint:dupes; pnpm knip   # advisory: duplicated code, unused files/exports/dependencies
pnpm -s lib --help           # CLI (use -s so pnpm does not print its banner into JSON output)
pnpm db:generate --name x    # new migration after editing packages/core/src/db/schema.ts
docker compose up -d --build # full deploy: app + db + nightly backup
```

System tools: `pandoc` (required for EPUB import) and `ebook-convert` from Calibre (MOBI/AZW only). The Docker image bundles both.

## Rules for agents

1. **Do not change `packages/core` (schemas, DB schema, `document.json` shape) without saying so explicitly** in your summary and updating `_agents/contracts/`. Everything else depends on it.
2. Ids are stable strings, never row numbers: document ids are slugs, chapter ids are `ch-NNN`, annotation ids are `a-xxxxxx`. They appear in URLs and in Claude's citations. Never renumber chapters of an existing document.
3. Writes to `library/<doc>/` go through `@study/core` helpers (`writeDocument`, `buildChapterFile`) or the bundle API (`lib pull` / `lib push`), never ad-hoc, so `contentHash`, `wordCount` and frontmatter stay consistent. After editing files on disk directly, run `pnpm -s lib reindex <doc>`.
4. Put temporary files in `_temp/` (e.g. `_temp/edit/<doc>` for `lib pull`). Never commit anything from `library/` or `_temp/`.
5. New importers live in `packages/ingest/src/`, are dispatched from `importSource()` in `index.ts`, end in `writeLibraryDocument()` and must write `import-report.json` warnings instead of failing on recoverable problems. Add an offline test under `packages/ingest/test/`.
6. API routes wrap handlers in `route()` (`apps/web/src/lib/http.ts`) for JSON errors. The CLI must keep working against a remote server, so never make it read `library/` directly.
7. Tests must run offline. Use `fixtures/` and the `fixtureImageFetcherWith404Fallback` helper, not live websites.
8. Only DRM-free content. Never add DRM removal.
9. Follow the code style in `_agents/conventions/coding.md` (enforced by `pnpm lint`): no comments (names carry the intent; TSDoc only on exported library functions), no magic numbers or one-letter names, regexes only in a package's `patterns.ts`, arrow functions with return types in library code, small functions and files. Run `pnpm lint:fix` after editing.

## Git

- Conventional Commits: `feat(scope): …`, `fix(scope): …`, `docs: …`, `test(scope): …`, `build: …`, `chore: …`, `refactor(scope): …`. Scopes: `core`, `ingest`, `anchoring`, `web`, `cli`, `skills`, `agents`.
- Commits are authored by the repository owner's git identity. **Do not add `Co-Authored-By` trailers or any AI attribution** to commits or PRs.
- One logical change per commit; run `pnpm lint`, `pnpm typecheck` and `pnpm test` before committing.

## Definition of done for a change

Lint, typecheck and tests pass; if it touches the reader, check it in the browser (`pnpm dev`, open a chapter of any imported document); if it touches a contract, `_agents/contracts/` is updated; if it changes how to run things, this file or `_agents/runbooks/` is updated. The `verify-mvp` skill runs the full end-to-end check.
