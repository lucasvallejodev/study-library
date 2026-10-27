# Testing

- `pnpm test` runs vitest over `packages/*/test/**/*.test.ts`. Everything is offline.
- Ingest tests import into a temporary `LIBRARY_DIR` (`useTempLibrary()`), never into `library/`.
- Web pages: add a saved page to `fixtures/html/` and serve its images through `fixtureImageFetcherWith404Fallback` (in `packages/ingest/test/helpers.ts`) (any URL ending in `<name>.png` maps to `fixtures/images/<name>.png`).
- EPUB: `packages/ingest/test/epub-fixture.ts` builds a small EPUB 3 at test time covering front/back matter, a title-only part page with TOC children, in-file sub-sections, an endnote, poetry line breaks, a figure and a cover. Add a case there when a real book reveals a new rule.
- UI changes: verify in the browser (see the `verify-mvp` skill). Anchoring logic belongs in `packages/anchoring` with unit tests.
