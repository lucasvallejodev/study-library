---
name: connect
description: Find links between a chapter or highlight and the rest of the user's library — the same idea in another book, a contradiction, an example of a principle, an earlier chapter it builds on — using full-text search over chapters and annotations, and save them as linked notes. Use for "/connect <doc> <chapter|a-id>", "where else have I read about this", "connect this to my other books", "related highlights".
argument-hint: <doc> <chapter> | <a-id> | <deep link>  [--scope library|book]
---

# Connect ideas across the library

Follow `_agents/conventions/skills.md`. No questions unless the target is unclear.

## Gather

1. Read the target (chapter or highlight with its chapter). Write down its 3–6 key concepts, using both the book's words and common synonyms.
2. Search the library for each concept:

```bash
pnpm -s lib search "<concept>"                         # chapters and annotations
pnpm -s lib annotations --query "<concept>" --format md # the user's own highlights and notes
pnpm -s lib list                                        # what is in the library
```

3. Open promising hits: `pnpm -s lib chapter <doc> <chapter> --with-annotations` (read around the hit, not just the snippet).

`--scope book` limits the search to the same document (earlier and later chapters).

## Judge

Keep only real connections, and name the kind:

- **Same idea**, said differently or in another field.
- **Builds on / is built on**: one needs the other.
- **Example of**: a concrete case of the principle.
- **Tension**: they disagree or pull in different directions.
- **Contrast**: same question, different answer.

Prefer connections to the user's own highlights and notes (they show what they cared about). 3–7 connections; none is better than a weak one. Say so when the library has nothing related yet.

## Write and save

```markdown
**Connections**

- **Same idea** — [Book · Chapter](deep link): one or two lines on how they relate. > short quote
- …

**Worth thinking about.** One question that the connections raise together.
```

Save as a note on the highlight, or a chapter note, tagged `claude,connect`. When a connection points at one of the user's highlights, also offer to add a short note on that highlight linking back (`--on <that-id>`), so the link works both ways.
