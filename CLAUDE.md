@AGENTS.md

## Claude Code specifics

- Project skills live in `.claude/skills/`. Use them:
  - `import-source`: import a book/URL/Markdown file and fix what the import report flags.
  - `study`: `/study <doc> <chapter> [--focus <annotation-id>]` runs a study session.
  - `review`: `/review [days]` mixed review of recent highlights and missed questions.
  - `study-notes`: write summaries, key ideas and glossaries for chapters as chapter notes.
  - `highlight-notes`: `/highlight-notes <doc> [chapter]` writes Claude's notes beside the user's highlights (margin, tagged `ai`).
  - `pdf-to-library`: turn a PDF (or any document Claude can read) into a library document.
  - `verify-mvp`: end-to-end check of the whole app after changes.
  - `ask`, `further-reading`, `visualize`, `primer`, `teach-back`, `exercises`, `critique`, `connect`, `chapter-synthesis`, `flashcards`: study helpers on a chapter or a highlight (see the table in `AGENTS.md`).
- Every study skill follows `_agents/conventions/skills.md`. Chapter images: `pnpm -s lib assets <doc> <chapter>` downloads them so you can open and read the diagrams.
- The `lib` CLI is the interface to the library for study work. Always call it as `pnpm -s lib …` from the repo root. It needs the web app running (`pnpm dev` locally, or `LIB_API_URL=http://homeserver:3000`).
- When quoting the user's highlights or correcting them, cite the deep link the CLI prints (`http://…/read/<doc>/<chapter>#a-xxxxxx`).
- `.claude/launch.json` starts the dev server (`web`) for the browser preview.
