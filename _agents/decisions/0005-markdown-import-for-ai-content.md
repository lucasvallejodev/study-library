# ADR 0005 — Markdown files as an import format

Status: accepted (2026-10-27)

PDF import is v0.3, but Claude Code can already read PDFs and other documents. Adding a `.md` importer (frontmatter metadata, chapters at `# ` headings, local images copied) gives every such source a path into the library today: the `pdf-to-library` skill converts, then runs `lib import file.md`. Source type `markdown` was added to `SourceSchema` (contract change).
