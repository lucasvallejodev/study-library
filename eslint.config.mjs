import stylistic from '@stylistic/eslint-plugin';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import perfectionist from 'eslint-plugin-perfectionist';
import preferArrow from 'eslint-plugin-prefer-arrow-functions';
import prettier from 'eslint-plugin-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

import multilineTypeAlias from './scripts/eslint-rules/multiline-type-alias.mjs';
import noComments from './scripts/eslint-rules/no-comments.mjs';

/** Rules that exist only in this repository (see scripts/eslint-rules/). */
const LocalRules = {
  rules: {
    'multiline-type-alias': multilineTypeAlias,
    'no-comments': noComments,
  },
};

/**
 * Names Next.js requires on module-level exports; they are exempt from the constant
 * naming rule below.
 */
const nextReservedExports =
  'metadata|viewport|config|dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration';

/** Pattern for a PascalCase identifier (`Colors`, `ChapterMatters`). */
const pascalCase = '^[A-Z][A-Za-z0-9]*$';

/** Selector fragments for a module-level `const` (plain or exported). */
const moduleConst =
  ':matches(Program, Program > ExportNamedDeclaration) > VariableDeclaration[kind="const"]';

const literalTable = ':matches(ObjectExpression, ArrayExpression)';
const notPascal = `VariableDeclarator[id.type="Identifier"][id.name!=/${pascalCase}/][id.name!=/^(${nextReservedExports})$/]`;

const constantNamingMessage =
  'Module-level constant objects and arrays are PascalCase (`Colors`, `ImporterExtensions`). Check the package before adding a new one.';

const regexMessage =
  "Regular expressions live in the package's `patterns.ts` (`Patterns`) under a name that says what they match.";

const colourMessage =
  'Hard-coded colour. Add it to the theme tokens in apps/web/src/app/globals.css and reference it as var(--color-…).';

/** eslint-plugin-jsdoc's preset for TSDoc: types come from TypeScript, never from comments. */
const tsdocPreset = jsdoc.configs['flat/recommended-tsdoc-error'];

/** Library code: every package's src and the web app's server helpers. */
const LibraryFiles = ['packages/*/src/**/*.ts', 'apps/web/src/lib/**/*.ts'];

/** Library code whose exported functions document their contract in TSDoc. */
const DocumentedFiles = [
  'packages/core/src/**/*.ts',
  'packages/anchoring/src/**/*.ts',
  'packages/ingest/src/**/*.ts',
  'apps/web/src/lib/**/*.ts',
];

const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'coverage/**',
      'library/**',
      '_temp/**',
      'samples/**',
      'fixtures/**',
      'backups/**',
      'packages/core/drizzle/**',
      '.claude/worktrees/**',
      '**/next-env.d.ts',
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  { settings: { next: { rootDir: 'apps/web/' } } },
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  sonarjs.configs.recommended,
  prettierConfig,
  {
    plugins: {
      '@stylistic': stylistic,
      local: LocalRules,
      perfectionist,
      'prefer-arrow-functions': preferArrow,
      prettier,
    },
    rules: {
      // Readability: blank lines. Prettier never adds blank lines, this rule does (fixable).
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],

      // Object literals with three or more properties and type aliases with three or more
      // members go one entry per line. Prettier keeps them expanded (objectWrap: preserve),
      // so the two tools agree.
      '@stylistic/object-curly-newline': [
        'error',
        {
          ObjectExpression: { consistent: true, minProperties: 3 },
          TSTypeLiteral: { consistent: true },
        },
      ],
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          next: '*',
          prev: 'directive',
        },
        {
          blankLine: 'any',
          next: 'directive',
          prev: 'directive',
        },
        {
          blankLine: 'always',
          next: '*',
          prev: 'import',
        },
        {
          blankLine: 'any',
          next: 'import',
          prev: 'import',
        },
        {
          blankLine: 'always',
          next: 'export',
          prev: '*',
        },
        {
          blankLine: 'any',
          next: 'export',
          prev: 'export',
        },
        {
          blankLine: 'always',
          next: 'return',
          prev: '*',
        },
        {
          blankLine: 'always',
          next: ['function', 'class', 'multiline-block-like'],
          prev: '*',
        },
        {
          blankLine: 'always',
          next: '*',
          prev: ['function', 'class', 'multiline-block-like'],
        },
        {
          blankLine: 'always',
          next: '*',
          prev: ['const', 'let'],
        },
        {
          blankLine: 'any',
          next: ['const', 'let'],
          prev: ['const', 'let'],
        },
        {
          blankLine: 'always',
          next: ['interface', 'type'],
          prev: '*',
        },
        {
          blankLine: 'any',
          next: ['interface', 'type'],
          prev: ['interface', 'type'],
        },
        // A declaration that spans several lines stands alone: blank line before and after.
        {
          blankLine: 'always',
          next: '*',
          prev: ['multiline-const', 'multiline-let', 'multiline-var'],
        },
        {
          blankLine: 'always',
          next: ['multiline-const', 'multiline-let', 'multiline-var'],
          prev: '*',
        },
      ],
      // TypeScript
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          detectObjects: false,
          enforceConst: true,
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      // Event handlers that return a promise are the normal React pattern.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignorePrimitives: {
            boolean: true,
            number: true,
            string: true,
          },
        },
      ],
      // Complexity budget. Warnings first; tighten to errors once the backlog is gone.
      complexity: ['warn', { max: 10 }],
      curly: ['error', 'multi-line'],
      // Names say what a value is for: no one-letter identifiers.
      'id-length': ['error', { min: 2, properties: 'never' }],
      'local/multiline-type-alias': ['error', { minMembers: 3 }],

      'local/no-comments': 'error',

      'max-depth': ['warn', 3],
      'max-lines': [
        'warn',
        {
          max: 400,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'warn',
        {
          IIFEs: true,
          max: 80,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-params': ['warn', 4],
      'no-restricted-syntax': [
        'error',
        {
          message: constantNamingMessage,
          selector: `${moduleConst} > ${notPascal} > ${literalTable}`,
        },
        {
          message: constantNamingMessage,
          selector: `${moduleConst} > ${notPascal} > :matches(TSAsExpression, TSSatisfiesExpression) > ${literalTable}`,
        },
        { message: regexMessage, selector: 'Literal[regex]' },
        { message: regexMessage, selector: 'NewExpression[callee.name="RegExp"]' },
        { message: colourMessage, selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]' },
        { message: colourMessage, selector: 'Literal[value=/^(rgb|hsl)a?\\(/]' },
        { message: colourMessage, selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{6}/]' },
      ],

      // Deterministic order (fixable): external imports, then `@/` and `@study/` modules, then
      // relative files, separated by blank lines; names, object properties and type members
      // alphabetically. A `// keep order` comment starts a group that is left as written.
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            'side-effect',
            ['builtin', 'external'],
            'internal',
            ['parent', 'sibling', 'index'],
            'unknown',
          ],
          internalPattern: ['^@/.+', '^@study/.+'],
          newlinesBetween: 1,
          type: 'natural',
        },
      ],

      'perfectionist/sort-named-exports': ['error', { type: 'natural' }],
      'perfectionist/sort-named-imports': ['error', { type: 'natural' }],
      'perfectionist/sort-object-types': [
        'error',
        { partitionByComment: ['^\\s*keep order'], type: 'natural' },
      ],
      'perfectionist/sort-objects': [
        'error',
        { partitionByComment: ['^\\s*keep order'], type: 'natural' },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      'sonarjs/cognitive-complexity': ['warn', 15],
      // Sonar rules that duplicate typescript-eslint or fight React conventions.
      'sonarjs/deprecation': 'off',

      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-selector-parameter': 'off',
      'sonarjs/prefer-read-only-props': 'off',
      'sonarjs/prefer-regexp-exec': 'off',
    },
  },
  {
    // Library code: arrow functions with explicit return types.
    files: LibraryFiles,
    ignores: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowIIFEs: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      'prefer-arrow-functions/prefer-arrow-functions': [
        'error',
        {
          allowNamedFunctions: false,
          allowObjectProperties: true,
          returnStyle: 'unchanged',
        },
      ],
    },
  },
  {
    // Library code documents its contract in TSDoc: every exported function has a
    // description, @param, @returns and @throws.
    files: DocumentedFiles,
    ignores: ['**/*.test.ts'],
    plugins: { ...tsdocPreset.plugins, tsdoc },
    rules: {
      ...tsdocPreset.rules,
      // TSDoc has no syntax for nested parameter names (`options.locale`); describe fields on `options`.
      'jsdoc/check-param-names': ['error', { checkDestructured: false }],
      'jsdoc/require-description': 'error',
      'jsdoc/require-hyphen-before-param-description': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { ArrowFunctionExpression: true, FunctionDeclaration: true },
        },
      ],
      'jsdoc/require-param': ['error', { checkDestructured: false }],
      'jsdoc/require-throws': 'error',
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
      'local/no-comments': ['error', { allowExportDocComments: true }],
      'tsdoc/syntax': 'error',
    },
  },
  {
    // Components are named exports so imports and searches all use the same name.
    files: ['apps/web/src/components/**/*.{ts,tsx}'],
    rules: { 'import/no-default-export': 'error' },
  },
  // Plain JS files (scripts, configs) are not part of the TypeScript project.
  { files: ['**/*.{js,mjs,cjs}'], ...tseslint.configs.disableTypeChecked },
  {
    // Column order in the schema is part of the Drizzle snapshot; keep it as written.
    files: ['packages/core/src/db/schema.ts'],
    rules: { 'perfectionist/sort-objects': 'off' },
  },
  {
    files: ['**/patterns.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['**/*.config.{ts,mts,js,mjs,cjs}', 'scripts/eslint-rules/**'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      'local/no-comments': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/test/**', '**/*.test.{ts,tsx,mjs}', '**/*.config.{ts,mts,js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'prefer-arrow-functions/prefer-arrow-functions': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  {
    // Test fixtures are local data, not shared constants; stubs are allowed to be empty.
    files: ['**/test/**', '**/*.test.{ts,tsx,mjs}'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-restricted-syntax': 'off',
      'sonarjs/no-floating-point-equality': 'off',
    },
  },
];

export default config;
