---
name: highlight-notes
description: Write Claude's notes on the user's highlights in a Study Library chapter — explanations, context, definitions, connections — shown in the reader's margin next to each passage, like comments in Google Docs. Use for "/highlight-notes <doc> [chapter]", "generate notes on my highlights", "explain what I highlighted", "annotate my highlights".
argument-hint: <doc> [chapter|all] [--only <annotation-id>] [--style explain|define|connect|question]
---

# Notes on highlights

Each note is a separate annotation attached to the same passage as the user's highlight, tagged `claude`. The reader shows it in the margin right under the user's own note, labelled "Claude's note", and only underlines the passage (it never repaints the user's highlight color).

## Gather

```bash
pnpm -s lib chapter <doc> <chapter> --with-annotations        # text with ==highlights==[^a-id] and the user's notes
pnpm -s lib annotations <doc> -c <chapter> -t highlight        # ids, quotes, colors, user notes
pnpm -s lib annotations <doc> -c <chapter> --tag claude        # notes you already wrote: don't duplicate
```

If the chapter has figures, `pnpm -s lib assets <doc> <chapter>` saves them to `_temp/assets/`; open the ones that matter, since diagrams often explain what the text only names.

No chapter given: `pnpm -s lib annotations <doc> -t highlight --since 30d` and group by chapter (or ask which chapter if there are many). `all` = every chapter with highlights. `--only <id>` = just that highlight.

Skip highlights that already have a `claude` note on the same passage unless the user asks to redo them (then update with `lib edit-note <id> --body …`).

## Write each note

Read the paragraph around the highlight (and the user's own note on it, if any — answer their question or build on their thought). 2–5 sentences, Markdown allowed. Pick what helps most:

- **Explain**: what the passage means, in plain words; unpack irony, archaic language, technical terms.
- **Context**: historical, biographical or cultural background the passage relies on.
- **Connect**: how it relates to earlier/later parts of the book (cite the chapter) or to the book's themes.
- **Question**: end with one short question that makes the user think, when useful.

Be accurate; say when something is interpretation. Never rewrite or delete the user's notes.

## Save

```bash
pnpm -s lib add-note <doc> --on <highlight-id> --type note --tags claude --body "<your note>"
```

`--on` copies the highlight's exact passage and chapter, so the note sits beside it. For long bodies write to `_temp/note.md` and pass `--body "$(cat _temp/note.md)"`.

Finish with a one-line summary per note (passage → gist) and the chapter link (`<LIB_API_URL>/read/<doc>/<chapter>`). Mention the margin toggle "With notes / All highlights".
