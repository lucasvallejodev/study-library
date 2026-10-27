---
name: review
description: Mixed review session across the Study Library using recent highlights, notes, review-later questions and previously missed answers. Use for "/review", "review what I read this week", "quiz me on my highlights".
argument-hint: [days=7] [doc]
---

# Mixed review

Arguments: optional number of days (default 7) and optional document id.

## Gather

```bash
pnpm -s lib annotations [doc] --since <N>d --format md                  # recent highlights and notes with deep links
pnpm -s lib annotations [doc] --type ai_question --tag review --format md  # open review-later questions
pnpm -s lib sessions [doc] --since 30d                                   # past questions with correct:false
```

If nothing is recent, widen to 30 days and say so.

## Run

- Build 8–12 items mixing documents and chapters: missed questions from past sessions (rephrased, not verbatim), open `ai_question` annotations, and new questions from recent highlights and notes (prefer "explain", "connect", "apply"). Interleave topics; don't group by book.
- One question at a time, wait for the answer, short feedback with the deep link to the passage.
- When the user answers a stored `ai_question` well, resolve it: `pnpm -s lib edit-note <id> --tags reviewed` (keep it, so history stays). When they miss one, keep it tagged `review`.
- New gaps: `pnpm -s lib add-note <doc> <chapter> --type ai_question --quote "<exact passage>" --body "<question>" --tags review`.

## Save

Group results per document and record one session per document:

```bash
pnpm -s lib record-session <doc> -k review -f _temp/review-<doc>.json   # same JSON shape as the study skill
```

Finish with the score per document, the 2–3 biggest gaps, and what to re-read (deep links). Delete the temp files.
