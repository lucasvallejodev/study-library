import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ChapterFrontmatterSchema,
  contentHash,
  countWords,
  DocumentSchema,
  parseChapterFile,
} from '../src/index';

const dir = path.resolve(import.meta.dirname, '../../../fixtures/library/sample-doc');

describe('document.json contract (hand-made fixture)', () => {
  it('validates and matches its chapter files', async () => {
    const doc = DocumentSchema.parse(
      JSON.parse(await readFile(path.join(dir, 'document.json'), 'utf8'))
    );

    expect(doc.chapters).toHaveLength(2);

    for (const ch of doc.chapters) {
      const { body, front } = parseChapterFile(await readFile(path.join(dir, ch.file), 'utf8'));

      expect(ChapterFrontmatterSchema.parse(front)).toEqual({
        document: doc.id,
        id: ch.id,
        order: ch.order,
        title: ch.title,
      });
      expect(contentHash(body.trim())).toBe(ch.contentHash);
      expect(countWords(body)).toBe(ch.wordCount);
    }
  });

  it('rejects ids that would break URLs', () => {
    expect(() =>
      DocumentSchema.parse({
        chapters: [],
        id: 'Bad Id',
        kind: 'book',
        source: {
          importedAt: new Date().toISOString(),
          type: 'url',
          url: 'https://a.b',
        },
        title: 'x',
      })
    ).toThrow();
  });
});
