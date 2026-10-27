# Study Library

A private, single-user study library. Import DRM-free books (EPUB, MOBI, AZW3), web articles and Markdown; read them in a clean Medium-style reader; highlight, annotate and deep-link any passage; then let Claude Code quiz you on what you read using your own highlights.

- **Content is plain Markdown on disk** (`library/<doc>/chapters/*.md`), one file per chapter, images kept.
- **Annotations live in PostgreSQL**: highlights in 4 colors, notes, chapter notes, bookmarks, tags, Claude's review questions, study sessions.
- **Claude Code integration** through the `lib` CLI and project skills (`/study`, `/review`, …).

## Quick start (development)

Requirements: Node 22+, Docker, `pandoc` (`brew install pandoc`). Calibre (`ebook-convert`) only for MOBI/AZW files.

```bash
corepack enable && pnpm install
cp .env.example .env
pnpm db:up          # Postgres 18 on 127.0.0.1:5433
pnpm dev            # http://localhost:3000
```

Import a book or article:

```bash
pnpm -s lib import path/to/book.epub
```

Or drop files on http://localhost:3000/import, or paste a URL there.

## Deploy on a home server

```bash
cp .env.example .env    # set DB_PASSWORD, LIBRARY_HOST_DIR, BACKUP_HOST_DIR, APP_BIND, PUBLIC_URL
docker compose up -d --build
```

Three services: `app` (Next.js + Calibre + Pandoc), `db` (Postgres 18), `backup` (nightly `pg_dump`, 14 days). There is no login: keep it on your LAN or behind Tailscale/WireGuard. Details: `_agents/runbooks/deploy-home-server.md`, backups: `_agents/runbooks/backup-restore.md`.

## Using it

| Where                   | What                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `/`                     | Library with covers, progress and "continue reading"                                          |
| `/read/<doc>`           | Table of contents, notes per chapter, re-import, export                                       |
| `/read/<doc>/<chapter>` | Reader: select text → highlight (4 colors), note, copy link, Ask Claude. ← / → change chapter |
| `/notebook`             | All highlights and notes; filter by document, type, color, tag; free-floating notes; backup   |
| `/search`               | Full-text search over every chapter and every note                                            |
| `/import`               | Upload or paste a URL; live job log and import report                                         |

## Studying with Claude Code

Open this folder in Claude Code (the server must be running; from another machine set `LIB_API_URL=http://homeserver:3000` in `.env`):

- `/study <doc> <chapter>` — 5–8 questions, one at a time, from recall to application, using your highlights. The session and any "review later" questions are saved; the questions appear in the reader's margin.
- `/review 7` — mixed review of the last week's highlights and missed answers.
- "Make study notes for chapter 3" (`study-notes`), "Import this PDF" (`pdf-to-library`), "Import this URL and clean it up" (`import-source`).
- The **Ask Claude** button in the reader copies a ready `/study … --focus <highlight>` prompt.

CLI reference: `pnpm -s lib --help` or `_agents/contracts/cli.md`.

## Code style

`pnpm lint` (ESLint with Prettier) enforces the code style described in `_agents/conventions/coding.md`; `pnpm lint:fix` applies the automatic fixes.

## Project layout

See `AGENTS.md` (also read by Claude Code via `CLAUDE.md`) and the `_agents/` knowledge base: product plan and roadmap, architecture, contracts, runbooks, decisions and conventions.

## Content and DRM

Only import content you have the right to use; this tool does not and will not remove DRM. Public-domain editions from [Standard Ebooks](https://standardebooks.org) are a good way to try it.
