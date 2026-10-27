# Skills

Skills live in `.claude/skills/<name>/SKILL.md`. They are plain Markdown with a short YAML header, so any agent can follow them: Claude Code loads them as slash commands, other agents (Codex, Cursor, Gemini CLI…) read the file when `AGENTS.md` points them to it. Every skill works through the `lib` CLI (`_agents/contracts/cli.md`), never by reading `library/` directly.

These rules apply to every study skill. A skill only repeats them when it needs to change one.

## Pick the target

A skill works on a **chapter** or on a **highlight/note**:

| The user gives                                | Resolve it with                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `<doc> <chapter>`                             | `pnpm -s lib chapter <doc> <chapter> --with-annotations`                                                              |
| An annotation id `a-xxxxxx`                   | `pnpm -s lib note <id>` → `documentId`, `chapterId`, `body`; the passage is the `exact` of its `TextQuoteSelector`    |
| A deep link `…/read/<doc>/<chapter>#a-xxxxxx` | Same: the path holds the doc and chapter, the hash the annotation id                                                  |
| A book title or "the chapter I'm reading"     | `pnpm -s lib list`, then `pnpm -s lib show <doc>` (last chapter read = highest `percent` < 1) and confirm in one line |

For a highlight, read the whole chapter anyway: the passage only makes sense in its context.

## Ask a little, not a lot

Before doing the work, a skill may ask **at most three short questions, all in one message**, each with a suggested default in brackets so the user can answer "defaults" or just press on. Skip any question the request already answers, and skip the round entirely when the target and the goal are clear. Never ask one question at a time before starting (interactive skills like `study` or `teach-back` ask one at a time _during_ the session, which is different).

Good: "Quick check before I search: 1) your level with this topic [beginner] 2) formats you like [videos + articles] 3) time you want to spend [under 2 h]".

## Look at the images

Chapters often explain more in their figures than in the text. Whenever the passage or chapter has images (`![…](../assets/…)` or `<img src="../assets/…">` in the chapter Markdown):

```bash
pnpm -s lib assets <doc> <chapter>        # saves them to _temp/assets/<doc>/<chapter>/ and prints file, alt text and line
```

Open the files near the passage (use `line` to match them to the text) and use what they show. Say so when an answer relies on a figure ("the diagram under section 3 shows…"). Agents that cannot read images use the alt text and say they could not see the figure.

## Be honest about sources

- Separate what the book says from what you add. Cite the book with a short quote or the deep link the CLI prints.
- Mark interpretation and outside knowledge as such ("Beyond the book: …").
- Web resources: only link pages you have actually opened in this session; never invent titles, authors, durations or URLs.

## Save results where the reader shows them

| Result about…        | Save with                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| One highlight        | `pnpm -s lib add-note <doc> --on <highlight-id> --type note --tags ai,<skill> --body …`                     |
| A chapter            | `pnpm -s lib add-note <doc> <chapter> --type note --tags ai,<skill> --body …` (shows under "Chapter notes") |
| A question to review | `pnpm -s lib add-note <doc> <chapter> --type ai_question --quote "<exact passage>" --tags review --body …`      |

- Tag every note with `ai` plus the skill name (`further-reading`, `visualize`…), so `/notebook?tag=<skill>` lists them.
- Before adding, look for an earlier note from the same skill (`pnpm -s lib annotations <doc> -c <chapter> --tag <skill>`) and update it with `pnpm -s lib edit-note <id> --body …` instead of duplicating.
- Long bodies: write `_temp/<skill>-<doc>-<chapter>.md` and pass `--body "$(cat _temp/<file>.md)"`; delete the file afterwards.
- Ask before saving when the result is conversational (`ask`, `teach-back`); save without asking when the user asked for a written result (`further-reading`, `visualize`, `primer`…).
- Finish with the deep link to what you saved.

## Writing notes

Notes are Markdown (GFM: lists, tables, task lists, code). Diagrams go in fenced ` ```mermaid ` blocks; the reader draws them. Keep diagrams small (under ~15 nodes) and label every arrow that is not obvious. Prefer `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`, `timeline` and `mindmap`.
