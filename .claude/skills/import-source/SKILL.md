---
name: import-source
description: Import a book (EPUB, MOBI, AZW3), a web article URL, a saved HTML page or a Markdown file into the Study Library, then review the import report and fix chapter splits, titles and Markdown artifacts. Use when the user says "import this book/URL/file", "add this to my library", or asks to clean up an imported document.
---

# Import a source and fix the result

The script does the deterministic 90 %; your job is the remaining 10 %: check the report, look at the output, fix what is wrong.

## 1. Import

```bash
pnpm -s lib health                              # server must be up (pnpm dev, or LIB_API_URL)
pnpm -s lib import <path-or-url> [--id short-id] [--toc-depth N]
```

- Paths are relative to the repo root. Supported: `.epub .mobi .azw .azw3 .html .md`, `http(s)://` URLs. PDFs: use the `pdf-to-library` skill instead.
- "already exists" → ask whether to `pnpm -s lib reimport <id>` (keeps chapter ids and annotations) or import a copy with `--id`.
- DRM errors are final: tell the user only DRM-free files work. Never try to remove DRM.

The command prints `documentId`, chapter count, words and `warnings`.

## 2. Review

```bash
pnpm -s lib show <doc>          # chapter list: titles, matter (front/body/back), wordCount
pnpm -s lib report <doc>        # full import-report.json
pnpm -s lib chapter <doc> <ch>  # spot-check the first body chapter, one in the middle, the last
```

Check: body chapter count matches the book's real table of contents; titles are human readable; no chapter is a bare title page; front matter (title page, imprint, license) is marked `front`/`back` rather than `body`; images and footnotes look right; no leftover HTML junk (`<span>`, `<div>`, empty links, repeated headers/footers, page numbers).

Warning codes: `short-chapter`, `long-chapter` (>25k words, consider splitting at `##`), `missing-image`, `broken-link`, `unresolved-toc-entry`, `no-toc`, `empty-content`, `fetch-fallback` (page needed JavaScript; content may be incomplete).

If the split is structurally wrong (every chapter merged, or every section split), first try re-importing with `--toc-depth 1` or `2` on a copy (`--id <doc>-test`), compare, then `lib remove` the worse one.

## 3. Fix with a pull / edit / push cycle

```bash
pnpm -s lib pull <doc>          # → _temp/edit/<doc>/{document.json, chapters/*.md, import-report.json}
# edit files in _temp/edit/<doc>/
pnpm -s lib push <doc>          # validates, recomputes hashes/word counts, rewrites frontmatter, reindexes
```

Rules while editing:

- **Never change the `id` of an existing chapter.** Highlights point at chapter ids. New chapters get a new unused id (`ch-NNN` above the current maximum).
- Retitle: change `title` in `document.json` (frontmatter is rewritten on push).
- Merge A+B: append B's body to A's file, remove B's entry from `document.json` (keep A's id). Mention that B's highlights would be orphaned if it had any (`pnpm -s lib annotations <doc> -c <B>`).
- Split: add a new entry with a new id and a new file (`chapters/NNN-slug.md`) right after the original; move the text.
- Matter: set `"matter": "front"` / `"back"` for boilerplate so the reader hides it by default.
- Markdown cleanup: fix only artifacts; never rewrite the author's text.
- `order`, `contentHash`, `wordCount` are recomputed; don't bother editing them.

## 4. Report back

Tell the user: document id and link (`<LIB_API_URL>/read/<doc>`), chapters and words, what you fixed, anything you left (with reasons). Clean up `_temp/edit/<doc>` when done.
