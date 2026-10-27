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
import { FixtureBook, writeFixtureEpub } from './epub-fixture';
import { useTempLibrary } from './helpers';

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

async function chapterMarkdown(document: LibraryDocument, title: string): Promise<string> {
  const chapter = document.chapters.find(entry => entry.title === title)!;

  return readFile(path.join(documentDir(document.id), chapter.file), 'utf8');
}

describe('EPUB import', () => {
  let epub: string;
  let document: LibraryDocument;

  beforeAll(async () => {
    await useTempLibrary();
    epub = await writeFixtureEpub();
    ({ document } = await importSource(epub));
  });

  it('follows the TOC, folding the part page and keeping in-file sections together', () => {
    const body = document.chapters.filter(chapter => chapter.matter === 'body');

    expect(document.id).toBe(FixtureBook.id);
    expect(document.authors).toEqual([FixtureBook.author]);
    expect(body.map(chapter => chapter.title)).toEqual(FixtureBook.bodyChapters);
    expect(document.chapters.find(chapter => chapter.title === 'Title Page')?.matter).toBe('front');
    expect(document.chapters.find(chapter => chapter.title === 'Endnotes')?.matter).toBe('back');
  });

  it('writes the report, the original, self-describing chapters, images and the cover', async () => {
    const report = JSON.parse(
      await readFile(path.join(documentDir(document.id), 'import-report.json'), 'utf8')
    ) as unknown;

    expect(ImportReportSchema.parse(report).chapterCount).toBe(document.chapters.length);
    expect(existsSync(path.join(documentDir(document.id), 'source/original.epub'))).toBe(true);
    expect(await expectSelfDescribingChaptersWithLocalImages(document)).toBe(1);
    expect(document.cover && existsSync(path.join(documentDir(document.id), document.cover))).toBe(
      true
    );
  });

  it('turns endnote references into per-chapter footnotes', async () => {
    const md = await chapterMarkdown(document, 'I: The Beginning');

    expect(md).toMatch(/\[\^1\][^:]/);
    expect(md).toMatch(/^\[\^1\]: The source of the claim\./m);
  });

  it('keeps poetry line breaks', async () => {
    expect(await chapterMarkdown(document, 'I: The Beginning')).toContain('Fury said to\\');
  });

  it('refuses a duplicate import and keeps chapter ids on re-import', async () => {
    await expect(importSource(epub)).rejects.toBeInstanceOf(DocumentExistsError);
    const before = await readDocument(FixtureBook.id);
    const { document: after } = await reimportDocument(FixtureBook.id);

    expect(after.chapters.map(chapter => [chapter.id, chapter.title])).toEqual(
      before.chapters.map(chapter => [chapter.id, chapter.title])
    );
  });
});
