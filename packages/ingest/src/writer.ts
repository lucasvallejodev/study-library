import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildChapterFile,
  type ChapterEntry,
  chapterFileName,
  chapterId,
  type ChapterMatter,
  contentHash,
  countWords,
  type ImportReport,
  libraryDir,
  type LibraryDocument,
  replaceDocumentDir,
  sha256,
  type Source,
  writeDocument,
} from '@study/core';

export type Warning = ImportReport['warnings'][number];

export type FinishedChapter = {
  depth: number;
  id: string;
  markdown: string;
  matter: ChapterMatter;
  sourceUrl?: string;
  title: string;
};

/** Images keyed by content hash, so duplicates are stored once. */
export class AssetStore {
  readonly files = new Map<string, Buffer>();
  add(data: Buffer, ext: string): string {
    const clean =
      (ext || 'bin')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/^jpeg$/, 'jpg') || 'bin';

    const name = `${sha256(data).slice(0, 16)}.${clean}`;

    this.files.set(name, data);

    return `assets/${name}`;
  }
}

const normaliseTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Chapter ids are stable: on re-import a chapter keeps its old id when its title matches
 * (nearest order wins for duplicate titles); new chapters get fresh numbers.
 *
 * @param titles
 * @param previous
 */
export const assignChapterIds = (titles: string[], previous?: LibraryDocument): string[] => {
  if (!previous) return titles.map((_, i) => chapterId(i + 1));
  const used = new Set<string>();

  const ids: (string | undefined)[] = titles.map((title, i) => {
    const key = normaliseTitle(title);

    const candidates = previous.chapters.filter(
      c => normaliseTitle(c.title) === key && !used.has(c.id)
    );

    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => Math.abs(a.order - (i + 1)) - Math.abs(b.order - (i + 1)));
    used.add(candidates[0].id);

    return candidates[0].id;
  });

  let next = Math.max(0, ...previous.chapters.map(c => Number(c.id.replace(/\D/g, '')) || 0)) + 1;

  return ids.map(id => {
    if (id) return id;
    while (used.has(chapterId(next))) next++;
    used.add(chapterId(next));

    return chapterId(next++);
  });
};

export type WriteInput = {
  assets: AssetStore;
  authors: string[];
  chapters: FinishedChapter[];
  cover?: string;
  description?: string;
  id: string;
  importer: string;
  kind: LibraryDocument['kind'];
  language?: string;
  source: Source;
  /** Files to copy into the document folder: relative path -> absolute source path or content */
  sourceFiles: { content?: string | Buffer; from?: string; relative: string }[];
  title: string;
  warnings: Warning[];
};

/**
 *
 * @param input
 */
export const writeLibraryDocument = async (
  input: WriteInput
): Promise<{ doc: LibraryDocument; report: ImportReport }> => {
  const buildDir = path.join(libraryDir(), `.build-${input.id}-${Date.now()}`);

  await mkdir(path.join(buildDir, 'chapters'), { recursive: true });
  await mkdir(path.join(buildDir, 'assets'), { recursive: true });
  await mkdir(path.join(buildDir, 'source'), { recursive: true });

  const warnings = [...input.warnings];
  const entries: ChapterEntry[] = [];
  const usedFiles = new Set<string>();

  for (const [i, ch] of input.chapters.entries()) {
    const order = i + 1;
    let file = chapterFileName(order, ch.title);

    while (usedFiles.has(file)) file = file.replace(/\.md$/, '-x.md');
    usedFiles.add(file);
    const body = ch.markdown.trim() || '_This chapter is empty._';

    await writeFile(
      path.join(buildDir, file),
      buildChapterFile(
        {
          document: input.id,
          id: ch.id,
          order,
          title: ch.title,
        },
        body
      )
    );
    const wordCount = countWords(body);

    entries.push({
      contentHash: contentHash(body),
      depth: ch.depth,
      file,
      id: ch.id,
      matter: ch.matter,
      order,
      title: ch.title,
      wordCount,
      ...(ch.sourceUrl ? { sourceUrl: ch.sourceUrl } : {}),
    });

    if (ch.matter === 'body' && wordCount < 200) {
      warnings.push({
        chapterId: ch.id,
        code: 'short-chapter',
        message: `"${ch.title}" has only ${wordCount} words`,
      });
    }

    if (wordCount > 25_000) {
      warnings.push({
        chapterId: ch.id,
        code: 'long-chapter',
        message: `"${ch.title}" has ${wordCount} words; consider splitting it`,
      });
    }
  }

  for (const [name, data] of input.assets.files) {
    await writeFile(path.join(buildDir, 'assets', name), data);
  }

  for (const f of input.sourceFiles) {
    const target = path.join(buildDir, f.relative);

    await mkdir(path.dirname(target), { recursive: true });
    if (f.from) await copyFile(f.from, target);
    else if (f.content !== undefined) await writeFile(target, f.content);
  }

  const doc: LibraryDocument = {
    authors: input.authors,
    id: input.id,
    kind: input.kind,
    title: input.title,
    ...(input.language ? { language: input.language } : {}),
    ...(input.description ? { description: input.description } : {}),
    source: input.source,
    ...(input.cover ? { cover: input.cover } : {}),
    chapters: entries,
  };

  await writeDocument(doc, buildDir);

  const report: ImportReport = {
    chapterCount: entries.length,
    chapters: entries.map(c => ({
      id: c.id,
      matter: c.matter,
      title: c.title,
      wordCount: c.wordCount,
    })),
    createdAt: new Date().toISOString(),
    documentId: input.id,
    importer: input.importer,
    totalWords: entries.reduce((n, c) => n + c.wordCount, 0),
    warnings,
  };

  await writeFile(
    path.join(buildDir, 'import-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  await replaceDocumentDir(input.id, buildDir);

  return { doc, report };
};

/**
 * Append Markdown footnote definitions to a chapter body.
 *
 * @param markdown
 * @param notes
 */
export const appendFootnotes = (markdown: string, notes: string[]): string => {
  if (notes.length === 0) return markdown;

  const defs = notes.map((note, i) => {
    const lines = note.trim().split('\n');

    return `[^${i + 1}]: ${lines[0] ?? ''}${lines
      .slice(1)
      .map(l => (l ? `\n    ${l}` : '\n'))
      .join('')}`;
  });

  return `${markdown.trimEnd()}\n\n${defs.join('\n\n')}\n`;
};

/**
 *
 * @param markdown
 */
export const tidyMarkdown = (markdown: string): string =>
  markdown
    .replace(/\r\n/g, '\n')
    .replace(/<\/?span[^>]*>/g, '')
    .replace(/ /g, ' ')
    .replace(/﻿/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
