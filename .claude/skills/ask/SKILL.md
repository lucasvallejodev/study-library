---
name: ask
description: Answer the user's questions about a chapter or one highlight in the Study Library, from the text and its figures, then suggest follow-up questions worth asking. Use for "/ask <doc> <chapter|a-id> <question>", "explain this passage", "what does this mean", "I don't get this part", "ask about this highlight".
argument-hint: <doc> <chapter> | <a-id> | <deep link>  [question]
---

# Ask about a chapter or a highlight

Follow `_agents/conventions/skills.md` (targets, images, honesty, saving).

## Prepare

1. Resolve the target and read the chapter with `--with-annotations`. For a highlight, also note the user's own note on it: it often holds the real question.
2. If the chapter has figures, run `pnpm -s lib assets <doc> <chapter>` and open the ones near the passage.
3. No question given? Ask one line: "What would you like to know about it?" and offer three likely questions as examples (what it means, why it matters, how it connects to …).

## Answer

- Lead with the direct answer in 2–5 sentences, then the explanation. Use the book's terms and quote it briefly.
- Separate "The book says" from "Beyond the book" when you add outside knowledge.
- When a figure carries the explanation, describe what it shows and refer to it.
- End every answer with **2–3 follow-up questions** the user could ask next, ordered from "understand it better" to "go further". Keep them specific to the passage.
- Keep the conversation going: the user may ask several questions in a row. Stay on the same target until they change it.

## Save (ask first)

When the conversation ends, or the user says "save it", offer to save a condensed Q&A:

```markdown
**Q:** …
**A:** … (condensed to what is worth remembering)

**Open questions:** …
```

On a highlight: `pnpm -s lib add-note <doc> --on <a-id> --type note --tags ai,ask --body …`. On a chapter: a chapter note with the same tags. If the user's own note asked a question you answered, say where the answer is saved.
