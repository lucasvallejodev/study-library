---
name: visualize
description: Make a chapter or one highlight easier to digest with diagrams (Mermaid), concrete worked examples, analogies, comparison tables or small runnable code, using the chapter's own figures, and save them as a note the reader draws. Use for "/visualize <doc> <chapter|a-id>", "draw a diagram of this", "give me an example", "explain this visually", "make this easier to understand".
argument-hint: <doc> <chapter> | <a-id> | <deep link>  [--mode diagram|examples|analogy|code|all]
---

# Visualize

Follow `_agents/conventions/skills.md`. Diagrams are Mermaid blocks; the reader draws them in notes.

## Ask (one message, skip what is known)

1. What helps you most [diagram + one worked example]
2. Code examples, and in which language [only for technical books; the book's language]
3. Anything specific that is confusing [the passage you picked]

## Understand first

Read the chapter (and highlight), then `pnpm -s lib assets <doc> <chapter>` and **open every figure near the target**. A complex figure in the book is often the best thing to rebuild: redraw it step by step, simpler, with the text's explanation attached to each part.

Find the one or two ideas that carry the passage: a process, a structure, a cause and effect, a comparison, a change over time.

## Pick the right shape

| The idea is…               | Use                                                       |
| -------------------------- | --------------------------------------------------------- |
| Steps or a decision        | `flowchart TD` (or `LR` for short pipelines)              |
| Messages between parts     | `sequenceDiagram`                                         |
| States and transitions     | `stateDiagram-v2`                                         |
| Parts and how they relate  | `flowchart` with subgraphs, `classDiagram` or `erDiagram` |
| Events in time             | `timeline`                                                |
| A concept and its branches | `mindmap`                                                 |
| Options with trade-offs    | A Markdown table                                          |
| A formula or a rule        | A worked example with real numbers, step by step          |

## Write

````markdown
**The idea in one line.** …

```mermaid
flowchart LR
  …
```

_How to read it:_ 2–4 bullets walking through the diagram.

**Worked example.** A concrete case with names and numbers, step by step, ending in the result.

**Analogy.** One everyday comparison, and where it breaks down.

**Check yourself.** One question the diagram should now let the user answer.
````

Rules: under ~15 nodes per diagram, labels in the book's words, label non-obvious arrows, split big ideas into two small diagrams. Code examples are short, complete and runnable; say how to run them and put longer ones in `_temp/visualize/<doc>/`. Check that the Mermaid parses: no parentheses or quotes inside unquoted labels (use `A["label (with parens)"]`).

## Save

Highlight: note on the highlight. Chapter: chapter note. Tags `ai,visualize`. Then tell the user to open the link: the diagram renders in the note (light and dark theme).
