# Code style

The goal is code that reads well for humans. The rules come from the owner's other project (my-budget-tracker) and are enforced by `eslint.config.mjs`; `pnpm lint:fix` applies everything that can be applied automatically, `pnpm lint` must end with 0 errors and 0 warnings.

| Tool                         | Enforces                                                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier (through ESLint)    | Line width 100, single quotes, trailing commas (es5), arrow parens avoided, 2-space indent (`.prettierrc.cjs`). Prettier never adds blank lines, which is why the next rules exist.                  |
| ESLint (`eslint.config.mjs`) | Blank lines, object/type layout, sorting, naming, magic values, comments, function style, TSDoc, complexity budget, type-aware TypeScript safety, React/Next.js/accessibility rules, SonarJS smells. |
| jscpd, knip                  | Advisory: `pnpm lint:dupes` (duplicated code), `pnpm knip` (unused files, exports, dependencies).                                                                                                    |

## Layout (fixable)

- Blank line after `'use client'` and the import block; before every `export`, function, class, type and `return`; after a group of `const`/`let`; around any declaration or block that spans several lines.
- Object literals with three or more properties and `type` aliases with three or more members: one entry per line. Prettier keeps an object expanded once there is a line break after `{`.
- Imports: external, then internal (`@/…`, `@study/…`), then relative, separated by blank lines. Named imports, object keys and type members are sorted alphabetically; put `// keep order` above entries whose order means something.
- Single-line guards without braces (`if (!doc) return null;`); multi-line bodies with braces.

## TypeScript and functions

- `type`, never `interface`. No `any` from JSON: type responses with the Zod schemas in `@study/core` or explicit types.
- Library code (`packages/*/src`, `apps/web/src/lib`): `export const name = (input: Input): Output => …` arrow functions with explicit return types. Classes only where state is natural (`EpubBook`, `AssetStore`).
- React components and Next.js pages stay `function` declarations; components are named exports. Pages read like an outline: load data through named helpers, render named sub-components, no computations inside JSX, no nested ternaries.
- Files are kebab-case (`annotation-card.tsx`, `use-margin-layout.ts`).

## Naming and values

- Every name says what the value is for; no one-letter names (`chapter => chapter.id`, `(left, right) =>`, `index`).
- Module-level constant objects and arrays are PascalCase (`ImporterExtensions`, `HighlightNames`); primitive constants are UPPER_CASE (`CONTEXT_LENGTH`).
- No magic numbers: anything but -1, 0, 1, indexes and defaults becomes a named constant next to its use.
- Regular expressions live only in the area's `patterns.ts` (`Patterns.footnoteToken`, `Patterns.httpUrl`), with small helpers when that reads better.
- Colours live in the theme tokens of `apps/web/src/app/globals.css`; TypeScript never contains hex/rgb literals.

## Comments and TSDoc

- No comments. When something needs explaining, express it with a better name, a small named helper, a named constant or a type. Allowed: tool directives (`eslint-disable-next-line rule -- reason`, `@ts-…`) and `// keep order`.
- Exported functions in `packages/core/src`, `packages/anchoring/src`, `packages/ingest/src` and `apps/web/src/lib` have a TSDoc block directly above them:

  ```ts
  /**
   * One sentence: what it returns or does.
   *
   * @remarks
   * Units, formats, fallbacks, caveats (omit when nothing is surprising).
   *
   * @param docId - What the value means (no `{type}`).
   * @returns What comes back.
   * @throws `Error` when … (whenever it can throw).
   */
  ```

## Complexity budget

Cyclomatic complexity 10 and cognitive complexity 15 per function, 80 lines per function, 400 lines per file, nesting depth 3, four parameters. Split into helpers, hooks and components before you hit them.
