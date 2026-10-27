# Reader and anchoring

Files: `apps/web/src/components/reader/{Reader,AnnotationCard,ChapterNotes,TocDrawer,paint,api}.tsx?`, `packages/anchoring/src/*`.

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

## Layout

≥1280px: three columns (spacer | 680px article | sticky annotation margin). Below: a "Notes" button opens a bottom sheet. TOC is a left drawer. Keyboard: ← / → previous/next chapter, Esc closes panels.
