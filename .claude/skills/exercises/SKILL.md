---
name: exercises
description: Hands-on practice for a chapter of a technical book (or a highlighted technique) — graded exercises, small coding tasks or design problems in _temp/, then review of the user's solutions with hints before answers. Use for "/exercises <doc> <chapter|a-id>", "give me exercises", "let me practice this", "a coding exercise on…".
argument-hint: <doc> <chapter> | <a-id> | <deep link>  [--count 3] [--language <lang>]
---

# Practice exercises

Follow `_agents/conventions/skills.md`. Best for technical and quantitative books; for others offer `teach-back` or `critique` instead.

## Ask (one message, skip what is known)

1. Kind of practice [coding tasks if the chapter has code, else short problems]
2. Language and setup [the book's language; plain scripts, no frameworks]
3. Difficulty and amount [3 exercises, easy → hard, ~45 min total]

## Prepare

Read the chapter and its figures (`pnpm -s lib assets`; diagrams and tables often define the exact behaviour to implement). Pick the techniques the chapter teaches, preferring highlighted ones.

Design exercises that practice the chapter's ideas, not trivia:

1. **Warm-up**: apply the technique once, as in the book, with different data.
2. **Variation**: change one constraint so the user must understand why it works.
3. **Stretch**: combine it with an earlier chapter, or debug a broken version.

## Set up

For coding tasks, create `_temp/exercises/<doc>/<chapter>/`:

- `README.md`: the tasks, what "done" means, how to run.
- One starter file per task with signatures and TODOs, and a test file (or a `check` script) the user runs to see if they passed. Make sure the starter runs and the tests fail before any work.
- Never put solutions in that folder.

For non-code problems, give them in the chat, one at a time.

## Review

When the user says they are done (or stuck): run the tests, read their code, and reply with what works, what does not and why, and a hint before any answer. Show the reference solution only when they ask or after two hints, then compare approaches and trade-offs. Point to the passage each fix relates to (deep link).

## Save

Ask before saving a chapter note tagged `ai,exercises` with the tasks, the user's result per task and the key lesson. Add `--type ai_question --tags review` questions for concepts they struggled with. Tell the user the folder path; `_temp/` is git-ignored.
