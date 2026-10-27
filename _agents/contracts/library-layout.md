# Library layout and document.json

Source of truth: `packages/core/src/schemas.ts` (`DocumentSchema`, `ChapterFrontmatterSchema`). This page explains it.

```
library/                         (LIBRARY_DIR; default <repo>/library)
  <doc-id>/
    document.json                metadata + ordered chapters — THE contract
    chapters/NNN-<slug>.md       YAML frontmatter + Markdown body
    assets/<sha256-16>.<ext>     images, content-addressed
    source/original.<ext>        untouched source (epub/mobi/azw3/md) or source/page.html for URLs
    import-report.json           warnings from the last import
    annotations.json             backup written by `lib export` (not read back automatically)
    annotations.md               human-readable backup
  notebook-notes.json            free-floating notes backup (`lib export` without a doc)
```

## document.json

```json
{
  "id": "alices-adventures-in-wonderland",
  "title": "Alice’s Adventures in Wonderland",
  "authors": ["Lewis Carroll"],
  "kind": "book",                         // book | article | docs
  "language": "en-GB",
  "description": "…",
  "source": { "type": "epub", "file": "source/original.epub", "importedAt": "2026-10-27T13:44:00.000Z" },
  "cover": "assets/b3e9747ee2b17878.jpg",
  "chapters": [
    {
      "id": "ch-006", "order": 6, "title": "I: Down the Rabbit-Hole",
      "file": "chapters/006-i-down-the-rabbit-hole.md",
      "contentHash": "sha256:…", "wordCount": 2146,
      "matter": "body",                   // front | body | back
      "depth": 2                          // TOC level, for indentation
    }
  ]
}
```

`source.type`: `epub | mobi | azw | azw3` (`file`), `url | docs` (`url`, optional `file` with saved HTML, `publishedAt`), `markdown` (`file`, optional `url`). Chapters may carry `sourceUrl` (web pages).

## Chapter file

```markdown
---
id: ch-006
title: "I: Down the Rabbit-Hole"
order: 6
document: alices-adventures-in-wonderland
---

## I: Down the Rabbit-Hole

Alice was beginning to get very tired…[^1]

[^1]: Footnote text pulled from the book's endnotes.
```

Body is GitHub-flavoured Markdown (+ footnotes, `$math$`); raw HTML is allowed for figures and complex tables and is sanitised when rendered. Images: `../assets/<hash>.<ext>`. Internal links: `/read/<doc>/<chapter>`.

## Invariants

- `order` is 1..n in array order; `contentHash` = `sha256:` + hex of the trimmed body; `wordCount` from `countWords(body)`. `lib push` and `writeLibraryDocument` recompute both — never hand-edit them.
- Ids: document `^[a-z0-9][a-z0-9-]*$`; chapters `ch-NNN` (never reused or renumbered for an existing document); annotations `a-[a-z0-9]{6}`.
- The DB index must be refreshed after any change on disk (`lib reindex <doc>`); `lib push` does it for you.
