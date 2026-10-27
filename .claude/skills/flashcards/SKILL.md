---
name: flashcards
description: Turn a chapter's key ideas and the user's highlights and notes into spaced-repetition flashcards — written as a tab-separated file Anki (or Mochi, RemNote, Quizlet) imports, and optionally as review questions in the Study Library. Use for "/flashcards <doc> [chapter|all]", "make flashcards", "export to Anki", "cards from my highlights".
argument-hint: <doc> [chapter|all] [--from highlights|chapter] [--review]
---

# Flashcards

Follow `_agents/conventions/skills.md`.

## Ask (one message, skip what is known)

1. Source [my highlights and notes; or the whole chapter's key ideas]
2. How many [about 1 card per highlight, max 20 per chapter]
3. Also add them to the library's review queue [no]

## Gather

```bash
pnpm -s lib chapter <doc> <chapter> --with-annotations
pnpm -s lib annotations <doc> -c <chapter> -t highlight,note
pnpm -s lib sessions <doc> -c <chapter>                   # missed questions make good cards
```

`all` = every body chapter with highlights (`pnpm -s lib show <doc>`). Use figures when a card is about a diagram (`pnpm -s lib assets`): describe what to recall from it in words.

## Write good cards

- One fact or idea per card; the answer fits in one or two lines.
- Ask for understanding, not wording: "Why does X need Y?" beats "Fill in: X needs ___".
- Use cloze only for definitions and key terms: `{{c1::term}} is …`.
- Give each card context so it makes sense months later (name the concept, not "it").
- No card for trivia the user did not highlight.

## Export

Write `_temp/flashcards/<doc>.tsv` (append chapters in order), one card per line, tab-separated, with this header for Anki:

```
#separator:tab
#html:false
#tags column:3
Front	Back	Tags
```

Tags: `study-library <doc> <chapter-id>`. Use `<br>` only if you switch to `#html:true`. Each Back ends with the deep link to the passage so the user can jump back to the book.

Tell the user: Anki → File → Import → choose the file (Mochi, RemNote and Quizlet also import tab-separated text).

## In the library (only with `--review` or a yes)

Add the cards as review questions so `/review` picks them up:

```bash
pnpm -s lib add-note <doc> <chapter> --type ai_question --quote "<exact passage>" --body "<front> — Answer: <back>" --tags review,flashcards
```

Finish with the card count per chapter and the file path.
