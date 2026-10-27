# Ingestion

Entry: `importSource(input, { id?, tocDepth?, db?, log?, fetcher?, sourceUrl? })` in `packages/ingest/src/index.ts`.

| Input                   | Importer                 | Notes                                                                                                                                    |
| ----------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `.epub`                 | `epub-*.ts`              | Own parser (JSZip + fast-xml-parser + jsdom)                                                                                             |
| `.mobi .azw .azw3 .prc` | `calibre.ts` → EPUB path | DRM check reads the MOBI header (record 0, bytes 12–13) before calling `ebook-convert`                                                   |
| `http(s)://…`           | `url.ts`                 | fetch → Defuddle (Markdown) → images downloaded → split at `##` over 8,000 words; Playwright retry when < 80 words (optional dependency) |
| `.html`                 | `url.ts`                 | Saved page; uses `<link rel=canonical>` or `--source-url` as base URL                                                                    |
| `.md`                   | `markdown.ts`            | YAML frontmatter (`title`, `authors`, `kind`, `description`, `source_url`); chapters at `# ` headings; local images copied               |
| `.pdf`                  | —                        | Not yet: use the `pdf-to-library` skill (Claude converts to `.md`, then imports)                                                         |

## EPUB algorithm (`sliceChapters` + `convertEpub`)

Modules: `epub-package.ts` (container, OPF, DRM check) → `epub-book.ts` (`EpubBook`) → `epub-toc.ts` (nav/NCX) → `epub-chapter-starts.ts` + `epub-matter.ts` → `epub-slicing.ts` (`sliceChapters`, `foldTitleOnlyPartPages`) → `epub-convert.ts` (`convertEpub`) with `epub-footnotes.ts`, `epub-images.ts`, `html.ts` (`cleanHtml`) and `writer.ts` (`tidyMarkdown`). `epub.ts` re-exports the public pieces.

1. `container.xml` → OPF → metadata, manifest, spine, cover (`properties="cover-image"` or `<meta name="cover">`). `META-INF/encryption.xml` with anything other than font obfuscation ⇒ DRM error.
2. TOC: EPUB 3 `nav[epub:type~=toc]`, else NCX. Entries are flattened with depth.
3. Chapter starts = TOC entries up to `--toc-depth` (default: all levels), with two rules learned from the samples:
   - **In-file sub-sections stay in their parent**: a child entry whose file equals the parent's file and has a `#fragment` (Sherlock Holmes story parts I, II, III) is not a chapter start.
   - **Title-only parents fold forward**: a body-matter part page with ≤ 30 words and no images that has TOC children is merged into the next chapter.
   - An anchor that is at the very start of its file is treated as the file start; duplicate starts are dropped.
4. A chapter = every node in spine order from its start to the next start (DOM `Range` across files). Spine content before the first entry becomes a "Front matter" chapter.
5. `matter` (front/body/back) from `epub:type` of the body/section (`frontmatter`, `backmatter`, `titlepage`, `colophon`, `endnotes`…) or well-known titles. The reader shows body chapters by default; front/back are one toggle away.
6. Conversion per chapter (6 in parallel): note references (`epub:type=noteref`/`role=doc-noteref`) become `[^n]` with the note text pulled from its target (usually `endnotes.xhtml`); images are copied to `assets/<sha256-16>.<ext>` and referenced as `../assets/…`; SVG-wrapped images become `<img>`; internal links become `/read/<doc>/<chapter>`; `cleanHtml()` drops styling attributes, unwraps layout containers, merges `<hgroup>` into one heading; then `pandoc -f html -t gfm+footnotes --wrap=none`; `tidyMarkdown()` strips stray spans and NBSP/BOM characters.
7. Chapter ids: `assignChapterIds()` gives `ch-001…` on first import; on re-import a chapter keeps the id of the old chapter with the same normalised title (nearest order wins); new chapters get numbers above the old maximum.

## Import report warnings

`missing-image`, `broken-link`, `short-chapter` (< 200 words, body only), `long-chapter` (> 25,000), `unresolved-toc-entry`, `no-toc`, `empty-content`, `fetch-fallback`, `other`. The `import-source` skill reads them and fixes what it can through `lib pull` / `lib push`.

## Adding an importer

1. `packages/ingest/src/<name>.ts` producing `FinishedChapter[]` + metadata (and assets via `AssetStore`).
2. Dispatch in `importSource()`; add the source type to `SourceSchema` in core if it is new (contract change: say so).
3. Re-import support in `reimportDocument()`.
4. Offline test in `packages/ingest/test/` with fixtures; update this file and the upload `accept` list in `apps/web/src/components/ImportClient.tsx` and `apps/web/src/app/api/import/route.ts`.
