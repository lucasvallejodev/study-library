import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  documentDir,
  ImportReportSchema,
  type LibraryDocument,
  parseChapterFile,
  readDocument,
} from '@study/core';

import { DocumentExistsError, importSource, reimportDocument } from '../src/index';
import { sample, useTempLibrary } from './helpers';

const books = [
  {
    body: 12,
    firstBody: 'I: Down the Rabbit-Hole',
    id: 'alices-adventures-in-wonderland',
    images: true,
    prefix: 'lewis-carroll',
  },
  {
    body: 28,
    firstBody: 'Letter I',
    id: 'frankenstein',
    images: false,
    prefix: 'mary-shelley',
  },
  {
    body: 12,
    firstBody: 'A Scandal in Bohemia',
    id: 'the-adventures-of-sherlock-holmes',
    images: false,
    prefix: 'arthur-conan-doyle',
  },
  {
    body: 117,
    firstBody: 'I: Marseilles—The Arrival',
    id: 'the-count-of-monte-cristo',
    images: false,
    prefix: 'alexandre-dumas',
  },
];

async function expectSelfDescribingChaptersWithLocalImages(
  document: LibraryDocument
): Promise<number> {
  let imageCount = 0;

  for (const chapter of document.chapters) {
    const raw = await readFile(path.join(documentDir(document.id), chapter.file), 'utf8');
    const { body: markdown, front } = parseChapterFile(raw);

    expect(front).toMatchObject({
      document: document.id,
      id: chapter.id,
      order: chapter.order,
    });

    for (const match of markdown.matchAll(/(?:\]\(|src=")\.\.\/(assets\/[^)"\s]+)/g)) {
      imageCount++;
      expect(existsSync(path.join(documentDir(document.id), match[1])), match[1]).toBe(true);
    }
  }

  return imageCount;
}

describe('EPUB import (Standard Ebooks samples)', () => {
  beforeAll(useTempLibrary);

  for (const book of books) {
    it(`imports ${book.id} following the TOC`, async () => {
      const { document, report } = await importSource(sample(book.prefix));

      expect(document.id).toBe(book.id);
      const body = document.chapters.filter(chapter => chapter.matter === 'body');

      expect(body).toHaveLength(book.body);
      expect(body[0].title).toBe(book.firstBody);
      expect(ImportReportSchema.parse(report).chapterCount).toBe(document.chapters.length);
      expect(existsSync(path.join(documentDir(book.id), 'import-report.json'))).toBe(true);
      expect(existsSync(path.join(documentDir(book.id), 'source/original.epub'))).toBe(true);

      const imageCount = await expectSelfDescribingChaptersWithLocalImages(document);

      if (book.images) expect(imageCount).toBeGreaterThan(30);
      expect(document.cover && existsSync(path.join(documentDir(book.id), document.cover))).toBe(
        true
      );
    });
  }

  it('turns endnote references into per-chapter footnotes', async () => {
    const doc = await readDocument('the-count-of-monte-cristo');
    const ch = doc.chapters.find(chapter => chapter.title === 'IV: Conspiracy')!;
    const md = await readFile(path.join(documentDir(doc.id), ch.file), 'utf8');

    expect(md).toMatch(/\[\^1\][^:]/);
    expect(md).toMatch(/^\[\^1\]: /m);
  });

  it('keeps poetry line breaks', async () => {
    const doc = await readDocument('alices-adventures-in-wonderland');
    const ch = doc.chapters.find(chapter => chapter.title.startsWith('III:'))!;
    const md = await readFile(path.join(documentDir(doc.id), ch.file), 'utf8');

    expect(md).toContain('“Fury said to\\');
  });

  it('refuses a duplicate import and keeps chapter ids on re-import', async () => {
    await expect(importSource(sample('mary-shelley'))).rejects.toBeInstanceOf(DocumentExistsError);
    const before = await readDocument('frankenstein');
    const { document: after } = await reimportDocument('frankenstein');

    expect(after.chapters.map(chapter => [chapter.id, chapter.title])).toEqual(
      before.chapters.map(chapter => [chapter.id, chapter.title])
    );
  });
});
