# Coding conventions

- TypeScript strict, ESM, Node 22. Prefer small modules with one job; export functions, not classes, unless state is natural (`EpubBook`, `AssetStore`).
- Validate at the edges with the Zod schemas from `@study/core` (API input, `document.json` reads). Inside, trust the types.
- Server-only modules in `apps/web/src/lib` start with `import "server-only"`. Route handlers are wrapped in `route()` and throw `HttpError`/`notFound()`.
- Paths inside a document go through `resolveInDocument()` (blocks `..` escapes).
- UI: Tailwind v4 utility classes with the theme tokens (`bg-paper`, `text-ink`, `text-muted`, `border-line`, `bg-panel`, `text-accent`); reading text uses `.reader-prose`. Dark mode via `data-theme` on `<html>`.
- Comments explain why, not what. Keep the existing density.
