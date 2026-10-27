# Roadmap and status

Last updated: 2026-10-27.

## v0.1 MVP — done

| Milestone              | Status | Where                                                                                                                        |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| M0 Scaffold + contract | Done   | `packages/core` (schemas, Drizzle schema, migration `0000_init`), `docker-compose.yml`                                       |
| M1 EPUB + MOBI ingest  | Done   | `packages/ingest/src/epub-*.ts`, `calibre.ts`; tests import all 4 samples; MOBI verified through Calibre in the Docker image |
| M2 Reader              | Done   | `apps/web/src/app/read/**`, `components/reader/*`                                                                            |
| M5 URL ingest          | Done   | `packages/ingest/src/url.ts`; offline tests over `fixtures/html` (blog, docs, news, JS-heavy, image-heavy)                   |
| M3 Annotations         | Done   | Highlights (4 colors), notes, chapter notes, bookmarks, tags, deep links, orphans, notebook                                  |
| M4 Import UI + jobs    | Done   | `/import`, `apps/web/src/lib/jobs.ts` (in-process queue in `import_jobs`, resumes after restart)                             |
| M6 CLI + skills        | Done   | `packages/cli`, `.claude/skills/*`                                                                                           |
| M7 Search + export     | Done   | `/search`, `GET /api/search`, `lib export`, notebook "Back up all annotations"                                               |

Extras beyond the plan: Markdown file import (`.md`, split at `#` headings) used by the `pdf-to-library` skill; `lib pull`/`lib push` edit bundles for AI cleanup; the `review`, `study-notes` and `verify-mvp` skills; `ai_question` annotations already show in the reader margin (planned for v0.2).

## v0.2 — next

1. Documentation-site crawling (`--crawl`): `llms.txt` → sidebar → `sitemap.xml`, `kind: docs`, per-page hashes, throttling. Entry point: `importSource()`; CLI flag already reserved.
2. MCP server `packages/mcp` wrapping the same API (`list_documents`, `get_chapter`, `search`, `get_annotations`, `add_annotation`, `record_study_session`) + Claude Code plugin packaging (`.claude-plugin/plugin.json`, skills, `.mcp.json`).
3. Study history UI: a `/sessions` page and per-chapter "last studied / score" on the document page.
4. Internal anchors: keep `id`s through Pandoc so in-book links land on the exact paragraph, not only the chapter.

## v0.3 — later

PDF import with Docling or Marker (today: `pdf-to-library` skill) · spaced-repetition queue from highlights and missed questions · reading stats · PWA for tablets · Obsidian-compatible export.

## Known limitations

- Chapters are matched by title on re-import; a renamed chapter gets a new id and its annotations stay on the old id (they show as orphaned in the notebook).
- Highlights are anchored against rendered text; heavy edits to a chapter can orphan them (listed in the margin, never deleted).
- No authentication: deploy on a LAN or behind Tailscale only.
