# Testing

- `pnpm test` runs vitest over `packages/*/test/**/*.test.ts`. Everything is offline.
- Ingest tests import into a temporary `LIBRARY_DIR` (`useTempLibrary()`), never into `library/`.
- Web pages: add a saved page to `fixtures/html/` and serve its images through `fixtureImageFetcherWith404Fallback` (in `packages/ingest/test/helpers.ts`) (any URL ending in `<name>.png` maps to `fixtures/images/<name>.png`).
- EPUB: the four Standard Ebooks samples cover nested TOCs (Alice, Frankenstein), in-file sections (Sherlock Holmes), endnotes and size (Monte Cristo, 117 chapters).
- UI changes: verify in the browser (see the `verify-mvp` skill). Anchoring logic belongs in `packages/anchoring` with unit tests.
