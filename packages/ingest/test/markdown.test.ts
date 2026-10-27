import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { documentDir } from '@study/core';

import { importSource } from '../src/index';
import { repo, useTempLibrary } from './helpers';

describe('Markdown import', () => {
  beforeAll(useTempLibrary);

  it('splits at level-1 headings, keeps frontmatter metadata and copies images', async () => {
    const { document } = await importSource(path.join(repo, 'fixtures/markdown/notes-on-logs.md'));

    expect(document.id).toBe('notes-on-logs');
    expect(document.authors).toEqual(['Study Library Fixtures']);
    expect(document.chapters.map(c => c.title)).toEqual([
      'Introduction',
      'Append-only storage',
      'Replication',
    ]);

    const ch2 = await readFile(
      path.join(documentDir(document.id), document.chapters[1].file),
      'utf8'
    );

    expect(ch2).toContain('## Append-only storage');
    expect(ch2).toContain('### Segments');
    const img = /\.\.\/(assets\/[a-f0-9]+\.png)/.exec(ch2)?.[1];

    expect(img && existsSync(path.join(documentDir(document.id), img))).toBe(true);

    const ch3 = await readFile(
      path.join(documentDir(document.id), document.chapters[2].file),
      'utf8'
    );

    expect(ch3).toContain('# not a heading inside a code block');
  });
});
