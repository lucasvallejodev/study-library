---
name: verify-mvp
description: End-to-end verification of the Study Library after code changes - tests, typecheck, imports, reader, annotations, CLI and Docker build. Use before merging a milestone, after touching ingestion, the reader or the API, or when the user asks "does everything still work?".
---

# Verify the MVP end to end

Run the steps that match what changed; run all of them before a release. Report each as pass/fail with the evidence (command output or screenshot), never "should work".

## 1. Static checks and tests

```bash
pnpm lint        # 0 errors, 0 warnings
pnpm typecheck
pnpm test        # anchoring, generated EPUB, 5 HTML fixtures, Markdown, DRM detection
```

## 2. Server and CLI

```bash
pnpm db:up
pnpm dev                                  # or the "web" launch config; wait for "DB ready"
pnpm -s lib health
pnpm -s lib import fixtures/markdown/notes-on-logs.md --id verify-notes
pnpm -s lib show verify-notes             # chapters "Append-only storage" and "Replication"
pnpm -s lib add-note verify-notes <ch-of-append-only-storage> --quote "ordered, durable and replayable" --type ai_question --body "test"
pnpm -s lib chapter verify-notes <ch> --with-annotations | head    # ==…==[^a-…] present
pnpm -s lib search "replay"
pnpm -s lib export verify-notes
```

## 3. Reader in the browser (preview tools or a browser)

Open `http://localhost:3000/read/verify-notes/<ch>` at ≥1280px wide:

- Text renders in the serif column, images visible, TOC drawer opens, prev/next links work, progress % moves on scroll.
- Select a sentence → popover → yellow: highlight painted and a card appears in the margin; "Note" opens the editor; save persists after reload.
- The CLI-created `ai_question` is painted (purple) and listed in the margin.
- Copy link → open the URL in a new tab → scrolls to and pulses the highlight.
- `/notebook` lists both; `/search?q=replay` finds chapters and notes; `/import` shows the job and its report.
- Resize to 375px: "Notes" opens the bottom sheet.

## 4. Re-anchoring

```bash
pnpm -s lib pull verify-notes
# insert a new paragraph near the top of the chapter file in _temp/edit/verify-notes/chapters/
pnpm -s lib push verify-notes
```

Reload the chapter: the highlights are still painted on the same words. Delete the highlighted sentence and push again: the card moves to "Orphaned" instead of disappearing.

## 5. Docker (before deploys)

```bash
docker compose build app
```

Optionally run it against a scratch DB and import a MOBI (convert an EPUB with `ebook-convert` inside the container) to confirm Calibre works.

## 6. Clean up

```bash
pnpm -s lib remove verify-notes --force
rm -rf _temp/edit/verify-notes
```
