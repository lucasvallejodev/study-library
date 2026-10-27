# Study Library — MVP Plan (original spec)

Oct 27, 2026 · Lucas Damian Vallejo Rosado

> This is the product spec the MVP was built from, kept as written. Where the implementation
> deliberately differs, see `_agents/decisions/`. Current status: `_agents/product/roadmap.md`.

## Overview

Build a local, single-user study library: one ingestion pipeline turns EPUB, MOBI and web pages into chapter-split Markdown, a Medium-style reader lets you highlight and annotate it, and Claude Code reads the same files to quiz you.

The core design choice: **content lives as plain Markdown files on disk, annotations live in PostgreSQL.** Files are easy to inspect, diff, back up and hand to an AI. The database handles what files are bad at: highlights, notes, search and study history.

**Goals for the MVP**

- Import EPUB and MOBI (upload in the UI, or a CLI command an AI can run) into one Markdown page per chapter, images kept.
- Import a single web article by URL the same way.
- Read chapters with a table of contents, progress and prev/next navigation.
- Highlight text, attach notes to highlights or whole chapters, and copy a permanent link to any highlight or note.
- Let Claude Code read a chapter plus your annotations and run a study session with you.

**Non-goals for now**

- Accounts, multi-user, cloud sync or hosting it publicly.
- DRM removal. Only DRM-free books are supported.
- Polished visual design beyond a clean reading column.
- PDF import (planned for later, see Roadmap).

## Architecture at a glance

Three entry points (web upload, `lib` CLI, Claude Code skill) call one ingestion library, which writes Markdown files and indexes them in PostgreSQL; the web reader and Claude Code both work from those two stores.

Everything runs on a home server with Docker Compose. The web app's API routes and the `lib` CLI import the same packages, so a feature added once (for example a new importer) is available in the UI, the CLI and to Claude at the same time.

## Tech stack

TypeScript end to end, shelling out to two mature CLIs (Calibre and Pandoc) for the hard format work.

| Layer | Choice | Why |
| --- | --- | --- |
| Monorepo | pnpm workspaces, Node 22+, TypeScript | One install, shared types between CLI, web and MCP server |
| Web app | Next.js (App Router) + React | Well known to coding agents; server routes for the API, client components for the reader |
| Reading style | Tailwind CSS + `@tailwindcss/typography` (`prose`) | Medium-like column: ~680px width, serif body, generous line height |
| Markdown rendering | unified: remark-parse, remark-gfm, remark-math, rehype-katex, rehype-slug, Shiki for code | Tables, footnotes, math and code blocks from technical books |
| Database | PostgreSQL + Drizzle ORM; full-text search (tsvector + GIN) and pg_trgm | Durable, runs in Docker, search built in, nightly pg_dump |
| MOBI/AZW3 to EPUB | Calibre `ebook-convert` CLI | Reads MOBI, AZW, AZW3 and more; scriptable |
| HTML to Markdown | Pandoc CLI (`-f html -t gfm`) per chapter | Best fidelity for tables, footnotes and nested lists |
| EPUB parsing | Own parser: JSZip + fast-xml-parser for OPF, nav.xhtml and toc.ncx | Chapter splitting must follow the book's TOC |
| Web articles | Defuddle (`defuddle/node`, Markdown output) + jsdom | Readability successor; keeps footnotes, math and code |
| JS-heavy pages | Playwright (optional fallback) | Renders pages that ship empty HTML |
| Highlight anchoring | W3C Web Annotation selectors (TextQuote + TextPosition) | Standard, survives re-imports (Hypothesis approach) |
| AI integration | CLI + Claude Code skills (MVP), MCP server + plugin (v0.2) | Skills are cheap; MCP adds structured read/write later |

## Deployment on the home server

One `docker compose up` with the app and PostgreSQL; all state lives in the Postgres volume and the `library/` folder.

- Migrations run on app start, so upgrading is `git pull && docker compose up -d --build`.
- Full restore = copy `library/` back + `psql` the latest dump. The JSON annotation export is a second safety net.
- No login, so keep it private: LAN only; Tailscale/WireGuard for outside access; optional Caddy basic auth.
- Claude Code on a laptop reaches the server through the app's HTTP API.
- Local development uses the same compose file with only `db` running and `pnpm dev` on the host.

## Content model and storage

Every source becomes a **document** with ordered **chapters** in `library/<doc>/`:

```
library/
  designing-data-intensive-applications/
    document.json          # metadata + ordered chapter list (the contract)
    source/original.epub   # untouched original, for re-imports
    chapters/001-preface.md
    assets/3f9a1c.png      # images renamed by content hash
    import-report.json     # warnings: missing images, empty chapters, odd TOC
```

Each chapter file starts with YAML frontmatter (`id`, `title`, `order`, `document`). PostgreSQL tables: `documents`, `chapters` (with tsvector), `annotations` (highlight, note, bookmark, ai_question; selector JSON; Markdown body; tags; orphaned flag), `reading_progress`, `study_sessions`, `import_jobs`.

Rules: ids are stable strings; the DB can be rebuilt from `library/` except annotations and study history (exported to `library/<doc>/annotations.json` + Markdown); re-imports keep chapter ids when titles and order match and re-anchor annotations.

## Ingestion pipeline

- **EPUB**: split by the book's TOC (nav.xhtml, fallback toc.ncx), not headings; a chapter is everything in spine order from its anchor to the next entry's anchor; front matter grouped; clean HTML; images to `assets/` by content hash; internal links to app routes; footnotes to per-chapter Markdown footnotes; Pandoc per chapter; write files, `document.json`, `import-report.json`; index. Fallback: one chapter per spine item.
- **MOBI/AZW/AZW3**: `ebook-convert` to EPUB, then the EPUB path. Detect DRM and refuse with a clear message.
- **Web page**: fetch; Playwright retry if nearly empty; Defuddle to Markdown with metadata; download images; one chapter, or split at `<h2>` above ~8,000 words.
- **Docs sites (v0.2)**: `llms.txt`, sidebar or sitemap discovery; one chapter per page; throttled; per-page hashes for re-import.
- **Import report**: chapter count, words per chapter, missing images, broken links, chapters under 200 or over 25,000 words, unresolved TOC entries.

## Reader, highlights and notes

Routes: `/` library, `/import`, `/read/[doc]`, `/read/[doc]/[chapter]`, `/notebook`, `/search?q=`.

Highlighting: select text → popover (4 colors, Add note, Copy link, Ask Claude) → TextQuote (exact + 32 chars prefix/suffix) and TextPosition selectors → `POST /api/annotations` → on load resolve position, verify quote, else fuzzy search, else mark `orphaned` and list it in the margin → paint with the CSS Custom Highlight API, falling back to `<mark>`.

Notes: on a highlight, on a whole chapter, or free-floating in the notebook; Markdown bodies. Deep links `/read/ddia/ch-002#a-7f3k2` scroll to and pulse the highlight. "Ask Claude" copies `/study ddia ch-002 --focus a-7f3k2`. Reading style: serif, ~680px, 1.7 line height, light/dark; notes in the right margin on wide screens, bottom sheet on narrow ones.

## AI integration with Claude Code

`lib` CLI over the HTTP API (`LIB_API_URL`): `list`, `chapter --with-annotations`, `annotations --since 7d --format md`, `add-note --quote --type ai_question`, `record-session`. Skills: `import-source`, `study-chapter` (5–8 questions, one at a time, recall → application, cite deep links, save session and "review later" questions as `ai_question` annotations), `review` (v0.2). v0.2: MCP server (`packages/mcp`) + Claude Code plugin.

## Roadmap

| Release | Includes |
| --- | --- |
| v0.1 MVP | EPUB + MOBI import (CLI and upload page) · single URL import · library, document and reader pages · highlights in 4 colors, notes, chapter notes · deep links · notebook · FTS search · Markdown/JSON export · Docker Compose deploy with nightly backups · `lib` CLI · `import-source` and `study-chapter` skills |
| v0.2 | Documentation-site crawling · MCP server + plugin · `review` skill · AI questions in the reader margin · tags |
| v0.3 | PDF import (Docling or Marker) · spaced repetition · reading stats · PWA · Obsidian export |

## Milestones (build plan)

| # | Milestone | Depends on | Done when |
| --- | --- | --- | --- |
| M0 | Scaffold + contract | – | Monorepo builds; Zod schemas; Drizzle schema + migration; compose Postgres; fixture validates; CLAUDE.md |
| M1 | EPUB + MOBI ingest | M0 | Public-domain EPUBs import with chapter count matching the TOC, images resolve, report written; MOBI converts via Calibre |
| M2 | Reader | M0 | Library, document and chapter pages render with TOC, prev/next, progress, code, tables, math and images |
| M5 | URL ingest | M0 | Saved HTML pages (blog, docs, news, JS-heavy, image-heavy) convert offline in tests; images stored locally |
| M3 | Annotations | M2 | Highlight, note, chapter note, deep link, notebook; anchoring tests incl. re-anchoring and orphans |
| M4 | Import UI + jobs | M1, M2 | Upload/URL creates a job, shows progress and report, opens the document; runs from docker compose; data survives restart |
| M6 | CLI + skills | M1, M3 | `lib` works; import → highlight → `/study` → session saved, AI questions anchored |
| M7 | Search + export | M3 | FTS over chapters and notes; export writes Markdown and JSON |

## Risks

EPUB variety (TOC-first splitting, report, AI cleanup skill) · Kindle DRM (detect and refuse) · highlight drift (quote + position, fuzzy, orphan list) · JS-only sites (Playwright fallback, saved HTML) · huge books (one chapter per page; warn over 25k words) · copyright (personal, local use only).
