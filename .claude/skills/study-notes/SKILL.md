---
name: study-notes
description: Create study material from a document in the Study Library — chapter summaries, key ideas, glossaries, timelines, character lists or practice questions — and save it as chapter notes the reader shows under each chapter. Use for "summarize this chapter/book", "make study notes", "create a glossary/flashcards for…".
argument-hint: <doc> [chapter|all] [summary|glossary|questions|characters|timeline]
---

# Study notes from a book

## Read

```bash
pnpm -s lib show <doc>                                   # chapters (skip matter front/back unless asked)
pnpm -s lib chapter <doc> <ch> --with-annotations        # text plus the user's own highlights and notes
```

For a whole book, work chapter by chapter (body chapters only) and keep each note self-contained.

## Write

Default per chapter (adapt to what was asked):

```markdown
**Summary.** 3–6 sentences in plain language.

**Key ideas**
- …(cite short quotes; link to the user's highlights by their deep link when relevant)

**Terms** — term: definition (only if the chapter introduces vocabulary)

**Questions to check yourself**
1. …
```

Fiction: characters introduced, plot beats, themes and techniques instead of "terms". Technical books: definitions, trade-offs, worked example. Keep the author's meaning; mark your own interpretations as such.

## Save

```bash
pnpm -s lib add-note <doc> <ch> --type note --tags study-notes,summary --body "$(cat _temp/notes-<doc>-<ch>.md)"
```

- Before adding, check for an existing study-notes note (`pnpm -s lib annotations <doc> -c <ch> --tag study-notes`) and update it with `pnpm -s lib edit-note <id> --body …` instead of duplicating.
- For a book-wide overview (e.g. timeline, character list), attach it to the first body chapter with tag `book-overview`.
- Want a file too? Also write `_temp/study-notes/<doc>.md` and tell the user the path.

End by listing the chapters you covered and how to find the notes (chapter page → "Chapter notes", or `/notebook?tag=study-notes`).
