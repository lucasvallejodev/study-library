---
name: chapter-synthesis
description: After the user finishes a chapter, pull together its main ideas, the user's own highlights and notes, past study results, how it connects to earlier chapters and what to apply or remember, into one synthesis note. Use for "/chapter-synthesis <doc> [chapter]", "I finished this chapter", "wrap up this chapter", "synthesize what I learned".
argument-hint: <doc> [chapter]
---

# Chapter synthesis

Follow `_agents/conventions/skills.md`. One chapter at a time, so it works for books of any size. No chapter given: use the chapter the user read last (`pnpm -s lib show <doc>`) and confirm in one line.

Unlike a summary (`study-notes`), a synthesis is about **what the user took from the chapter**: it is built from their highlights, notes and answers, not only from the text.

## Ask (one message, optional)

1. What you want to keep from it [ideas to remember]; or [things to apply at work / in a project], [arguments to discuss]

## Gather

```bash
pnpm -s lib chapter <doc> <chapter> --with-annotations     # text + the user's highlights and notes
pnpm -s lib sessions <doc> -c <chapter>                     # study / teach-back results: what stuck, what did not
pnpm -s lib annotations <doc> -c <chapter> --tag claude     # earlier Claude notes (ask, visualize, further-reading…)
pnpm -s lib annotations <doc> --tag chapter-synthesis       # syntheses of earlier chapters, to link the thread
```

Open figures that carry the chapter's main idea (`pnpm -s lib assets`).

## Write (one screen)

```markdown
**The chapter in three ideas.**

1. … (link the highlight that captures it best)

**What you marked.** The pattern in the user's highlights and notes: what they focused on, what they questioned.

**Still shaky.** Points missed in study sessions or open review questions, with deep links.

**Thread so far.** How this chapter moves the book's argument on from the previous syntheses (one or two lines).

**Use it.** 1–3 concrete ways to apply it, matched to what the user said they want to keep.

**Remember.** One sentence worth keeping if they forget everything else.
```

Optionally one small Mermaid diagram if the chapter's ideas form a clear structure.

## Save

Chapter note tagged `claude,chapter-synthesis` (update the existing one if it exists). Suggest `/flashcards` for the "Remember" and "Still shaky" points.
