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
.claude/skills/      Study skills as plain SKILL.md files, usable by any agent (see "Skills" below)
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

## Skills (for any agent)

Each skill is a Markdown playbook in `.claude/skills/<name>/SKILL.md`. Claude Code runs them as `/<name>`; other agents: when the user asks for one of these by name or by intent, read that file and follow it. All of them share `_agents/conventions/skills.md` (how to pick a chapter or highlight, ask at most three questions, look at the chapter's images with `lib assets`, cite honestly and save results).

| Skill               | Use it to                                                                       |
| ------------------- | ------------------------------------------------------------------------------- |
| `ask`               | Answer questions about a chapter or highlight, with follow-up questions         |
| `further-reading`   | Find and check videos, articles, docs and papers to go deeper                   |
| `study-notes`       | Summaries (TL;DR, one page, by section, your highlights), key ideas, glossaries |
| `visualize`         | Diagrams (Mermaid), worked examples, analogies and code to digest a passage     |
| `primer`            | Prepare for a chapter before reading it, without spoilers                       |
| `study`             | Quiz on a chapter, one question at a time                                       |
| `teach-back`        | Explain a concept in your own words and get the gaps pointed out                |
| `exercises`         | Hands-on practice for technical chapters, with tests in `_temp/exercises/`      |
| `critique`          | Steelman a claim, then objections, limits and what survives                     |
| `connect`           | Link a chapter or highlight to the rest of the library                          |
| `highlight-notes`   | Write Claude's notes beside the user's highlights                               |
| `chapter-synthesis` | Wrap up a finished chapter from the user's own highlights, notes and results    |
| `flashcards`        | Export cards to Anki (TSV) and optionally to the review queue                   |
| `review`            | Mixed review of recent highlights and missed questions                          |
| `import-source`     | Import a book, URL or Markdown file and fix the import report                   |
| `pdf-to-library`    | Turn a PDF or any readable document into a library document                     |
| `verify-mvp`        | End-to-end check of the app after code changes                                  |

The reader's **Copy for AI** buttons (chapter toolbar and each note) copy a self-contained prompt for assistants that cannot run the CLI.

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
