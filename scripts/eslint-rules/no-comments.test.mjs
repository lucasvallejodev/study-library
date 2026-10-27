import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';

import noComments from './no-comments.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const docOptions = [{ allowExportDocComments: true }];

ruleTester.run('no-comments', noComments, {
  invalid: [
    { code: '// explains\nconst total = 1;', errors: [{ messageId: 'comment' }] },
    { code: '/* explains */\nconst total = 1;', errors: [{ messageId: 'comment' }] },
    {
      code: '/** Adds one. */\nexport const addOne = value => value + 1;',
      errors: [{ messageId: 'comment' }],
    },
    {
      code: '/** Floating. */\nconst addOne = value => value + 1;',
      errors: [{ messageId: 'floatingDocComment' }],
      options: docOptions,
    },
    {
      code: 'export const addOne = value => {\n  /** Inside. */\n  return value + 1;\n};',
      errors: [{ messageId: 'floatingDocComment' }],
      options: docOptions,
    },
    {
      code: '/** Adds one. */\nexport const addOne = value => value + 1; // trailing',
      errors: [{ messageId: 'comment' }],
      options: docOptions,
    },
  ],
  valid: [
    '// eslint-disable-next-line no-console\nconsole.log(1);',
    '// keep order\nconst Steps = { second: 2, first: 1 };',
    { code: '/** Adds one. */\nexport const addOne = value => value + 1;', options: docOptions },
    { code: '/** The default. */\nexport default 1;', options: docOptions },
  ],
});
