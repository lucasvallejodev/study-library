# Reader and anchoring

Files: `apps/web/src/components/reader/` — `reader.tsx` composes the hooks (`use-anchored-annotations`, `use-margin-layout`, `use-reading-progress`, `use-selection-popover`, `use-deep-link`, `use-chapter-keyboard`, `use-article-click`, …) and components (`article.tsx`, `margin-notes.tsx`, `selection-popover.tsx`, `notes-sheet.tsx`, `annotation-card.tsx`, `toc-drawer.tsx`, …); painting in `paint.ts`. Anchoring logic: `packages/anchoring/src/*`.

## Text model

The chapter article is rendered once (`dangerouslySetInnerHTML`, memoised) and never re-rendered by React, so DOM ranges stay valid. `textOf(article)` (= `textContent`) is the coordinate space for all selectors. The server computes the same string from the hast tree, so offsets agree between browser and CLI.

## Creating a highlight

Selection → `offsetsFromRange` → trim whitespace → `describeRange(text, start, end)` gives `[TextQuoteSelector{exact,prefix(32),suffix(32)}, TextPositionSelector{start,end}]` → `POST /api/annotations`.

## Resolving (every load)

`resolveSelectors(text, selectors)`:

1. Position slice equals `exact` → `exact`.
2. All exact occurrences of the quote, ranked by prefix/suffix similarity and distance to the old position → `moved`.
3. `approx-string-match` with up to 25 % errors → `fuzzy`.
4. Nothing → `null` ⇒ the client PATCHes `orphaned: true`; orphans are listed under "Orphaned" in the margin, never deleted.
   When a match is `moved`/`fuzzy` (or an orphan comes back), the client PATCHes fresh selectors so the next load is exact.

## Painting

CSS Custom Highlight API (`CSS.highlights`): one `Highlight` per color plus `hl-question` (Claude questions), `hl-note` (underline when a highlight has a note) and `hl-active` (deep-link pulse/selection). Clicks on painted text are mapped back with `caretPositionFromPoint` + `Range.isPointInRange`. Fallback for old browsers wraps text nodes in `<mark data-annotation>`.

## Deep links and progress

`#a-xxxxxx` scrolls the range to a third of the viewport and pulses it (2.5 s); orphans open the notes sheet instead. Scroll position (0–1 through the article) is POSTed to `/api/progress` debounced, plus a `sendBeacon` on hide; `percent` only moves forward, `position` follows the reader and is restored on the next visit.

## Layout: wide column and note bubbles

The text column is up to 900px wide; figures and standalone images may extend to 1,100px (`--reader-figure-width` in `globals.css`), tables scroll sideways, and clicking an image opens it scaled to the screen (`image-lightbox.tsx`). There is no notes margin:

- A passage with a note or a Claude question ends in a small dot (`note-markers.tsx`, measured from the range's last line).
- Clicking painted text or a dot opens `note-bubble.tsx` under the passage: every annotation overlapping that passage (`passages.ts`), yours first, then Claude's notes and questions, in larger text with edit/color/link/Ask Claude/delete. Click elsewhere, the ✕ or Esc closes it.
- "Note" in the selection popover opens the bubble with the editor focused (`preventScroll`); deep links (`#a-…`) pulse the passage and open its bubble. The bubble only scrolls the page when the passage or the bubble would be hidden (below the 100px of sticky headers or past the viewport bottom).
- "Notes (n)" in the toolbar opens the list of every note in the chapter (`notes-sheet.tsx`); orphaned notes are listed under the text. "✦ Claude notes" copies `/highlight-notes <doc> <chapter>`.
- Positions re-measure on resize and when the article changes size (`use-layout-tick.ts`).

TOC is a left drawer. Keyboard: ← / → previous/next chapter, Esc closes panels.

## Notes: Markdown and tags

`components/notes/` holds the note UI shared by the bubble, the Notes list, chapter notes and the notebook:

- `markdown-view.tsx` renders note bodies with `react-markdown` + GFM (no raw HTML), styled by `.note-prose` in `globals.css`; links open in a new tab. Usable from server and client components.
- `markdown-editor.tsx` is a textarea with a formatting toolbar (bold, italic, strikethrough, code, link, heading, quote, lists, checklist, code block), shortcuts ⌘B / ⌘I / ⌘E / ⌘K, ⌘↵ to save, Esc to cancel, a Write/Preview switch and auto-grow. The text transforms are pure functions in `markdown-formatting.ts` (tested).
- `tag-input.tsx` shows tags as chips and suggests existing tags from `GET /api/tags` (`use-known-tags.ts`, cached per page load and refreshed after a save). Enter, Tab or comma adds the highlighted suggestion or the typed tag (spaces become dashes); Backspace on an empty field removes the last tag; ↑/↓ move through suggestions.
