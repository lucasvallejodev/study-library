---
name: study-notes
description: Create study material from a document in the Study Library — chapter summaries at the length you want (TL;DR, one page, section by section, or only your highlights), key ideas, glossaries, timelines, character lists or practice questions — and save it as chapter notes the reader shows under each chapter. Use for "summarize this chapter/book", "make study notes", "create a glossary/flashcards for…".
argument-hint: <doc> [chapter|all|a-id] [summary|glossary|questions|characters|timeline] [--length tldr|page|sections|highlights]
---

# Study notes from a book

## Read

```bash
pnpm -s lib show <doc>                                   # chapters (skip matter front/back unless asked)
pnpm -s lib chapter <doc> <ch> --with-annotations        # text plus the user's own highlights and notes
```

For a whole book, work chapter by chapter (body chapters only) and keep each note self-contained. Follow `_agents/conventions/skills.md`; when the chapter has figures, run `pnpm -s lib assets <doc> <chapter>` and use what they show (a diagram often is the summary).

If the user did not say what they want, ask once (one message): "1) What for [quick refresher] 2) Length [TL;DR]".

## Summary lengths

| `--length`   | What to write                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `tldr`       | 3–5 bullets, one idea each, no intro.                                                                                    |
| `page`       | Default: the template below, about one screen.                                                                           |
| `sections`   | One short paragraph per section heading of the chapter (`##`/`###`), in order, each linking the user's highlights in it. |
| `highlights` | Only what the user highlighted and noted, grouped by idea, with their notes woven in — a summary of _their_ reading.     |

A highlight id instead of a chapter (`a-xxxxxx`): summarize the passage and the paragraphs around it in plain words, and save it on the highlight (`--on <id>`).

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
