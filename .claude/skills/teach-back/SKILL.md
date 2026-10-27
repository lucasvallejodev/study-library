---
name: teach-back
description: Feynman-style check of real understanding — the user explains a chapter's idea or a highlighted concept in their own words, and Claude points out what is missing, wrong or vague, then asks them to try again. Use for "/teach-back <doc> <chapter|a-id>", "let me explain it back", "check if I understood", "Feynman technique".
argument-hint: <doc> <chapter> | <a-id> | <deep link>  [concept]
---

# Teach it back

Follow `_agents/conventions/skills.md`. This is interactive: one turn at a time, wait for the user.

## Prepare (silently)

Read the chapter (and highlight) and its figures (`pnpm -s lib assets`). List the 1–3 central concepts and, for each, the points a complete explanation must contain (definition, how it works, why it matters, an example, a common misconception). Check past sessions (`pnpm -s lib sessions <doc> -c <chapter>`) for earlier misses.

## Run

1. Pick the concept: the highlight's, the one the user named, or offer the 1–3 central ones and let them choose. One line.
2. Ask: "Explain <concept> as if to a smart friend who hasn't read the book. No peeking." Wait.
3. Give feedback in this shape:
   - **Got it:** the points they covered correctly.
   - **Missing:** points from your checklist they skipped, as hints, not answers ("what happens when…?").
   - **Off:** anything wrong or vague, with the passage quote or deep link that corrects it.
   - **Jargon check:** terms they used without explaining.
4. Ask them to explain again, covering the gaps. Repeat at most three rounds, then give the model explanation (short, in plain words, with the figure if one helps) and compare it with theirs.
5. Optionally finish with one transfer question: apply the idea to a new case.

## Save

Record the session (`kind` study, one entry per round with `correct` = whether the explanation was complete):

```bash
pnpm -s lib record-session <doc> <chapter> -f _temp/teach-back-<doc>-<chapter>.json
```

For each point they kept missing, add a review question anchored to the passage (`--type ai_question --tags review`). Ask before also saving their final explanation as a note on the highlight (tags `ai,teach-back`): it is a great thing to reread later.
