---
name: study
description: Run an interactive study session on a chapter from the user's Study Library, using their highlights and notes, asking one question at a time and saving the session and review-later questions back to the library. Use for "/study <doc> <chapter>", "quiz me on…", "help me study chapter…".
argument-hint: <doc> [chapter] [--focus <annotation-id>]
---

# Study a chapter

Arguments: `<doc> [chapter] [--focus a-xxxxxx]`. If the chapter is missing, run `pnpm -s lib show <doc>` and pick the chapter the user last read (highest `percent` < 1 among body chapters, else the first unread body chapter) — confirm it with the user in one line. If the doc id is unknown, run `pnpm -s lib list` and match by title.

## Prepare (silently)

```bash
pnpm -s lib chapter <doc> <chapter> --with-annotations   # text + ==highlights==[^a-id] with notes and deep links
pnpm -s lib sessions <doc> -c <chapter>                    # past sessions: avoid repeating questions, revisit misses
```

With `--focus <id>`, center the session on that passage (`pnpm -s lib annotations <doc> -c <chapter>` shows it) but still cover the chapter's main ideas.

Plan 5–8 questions that move from **recall → understanding → application**:

1. Recall of key facts/events/definitions (1–2).
2. "Explain in your own words" for the main ideas (2–3).
3. Connections: why, cause/effect, compare to another part (1–2).
4. Application or transfer to a new case, or for fiction: interpretation of character, theme, technique (1–2).
   Prefer passages the user highlighted or annotated: their highlights show what they care about; their notes show their current understanding. Avoid trivia.

## Run the session

- Say in one line what the session covers and how many questions. Then **ask one question at a time and wait for the answer.** Never list all questions up front.
- After each answer give short feedback: what was right, what was missing or wrong, and cite the passage with its deep link from the CLI output (`<url>/read/<doc>/<chapter>#a-…`) or a short quote. Track `correct: true | false` (partial = false, explain why).
- If the user is stuck, give a hint before the answer. If they ask to stop, stop and save what you have.

## Save

1. Write the session to `_temp/session-<doc>-<chapter>.json`:

```json
{
  "questions": [
    {
      "question": "…",
      "answer": "user's answer, condensed",
      "feedback": "…",
      "correct": false,
      "quote": "short passage",
      "annotationId": "a-… if about a highlight"
    }
  ],
  "score": 0.63,
  "summary": "2–3 sentences: what the user understands well, where the gaps are",
  "followUps": ["Re-read the part about …"]
}
```

```bash
pnpm -s lib record-session <doc> <chapter> -f _temp/session-<doc>-<chapter>.json
```

2. For every missed or shaky question, anchor a review-later question to the passage so it shows in the reader margin:

```bash
pnpm -s lib add-note <doc> <chapter> --type ai_question --quote "<exact short passage from the chapter>" --body "<question> — Hint: <hint>" --tags review
```

Use an exact sentence (or part) from the chapter text as `--quote`; on a 422 "quote not found", retry with a shorter exact fragment.

3. End with a short summary of gaps and the score, and point to the margin questions. Delete the temp JSON.
