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

import { Patterns } from './patterns';

const ASSET_HASH_LENGTH = 16;
const FALLBACK_ASSET_EXTENSION = 'bin';
const SHORT_CHAPTER_WORDS = 200;
const LONG_CHAPTER_WORDS = 25_000;
const JSON_INDENT = 2;
const FOOTNOTE_CONTINUATION_INDENT = '    ';
const EMPTY_CHAPTER_BODY = '_This chapter is empty._';

const BuildSubfolders = ['chapters', 'assets', 'source'];

/** One entry of an import report's warning list. */
export type Warning = ImportReport['warnings'][number];

/** A converted chapter, ready to be written into the document folder. */
export type FinishedChapter = {
  depth: number;
  id: string;
  markdown: string;
  matter: ChapterMatter;
  sourceUrl?: string;
  title: string;
};

const assetExtension = (extension: string): string =>
  (extension || FALLBACK_ASSET_EXTENSION)
    .toLowerCase()
    .replace(Patterns.nonAlphanumericLowercase, '')
    .replace(Patterns.jpegExtension, 'jpg') || FALLBACK_ASSET_EXTENSION;

/** Images keyed by content hash, so duplicates are stored once. */
export class AssetStore {
  readonly files = new Map<string, Buffer>();

  add(data: Buffer, extension: string): string {
    const name = `${sha256(data).slice(0, ASSET_HASH_LENGTH)}.${assetExtension(extension)}`;

    this.files.set(name, data);

    return `assets/${name}`;
  }
}

const normaliseTitle = (title: string): string =>
  title.toLowerCase().replace(Patterns.nonLetterOrDigitRun, ' ').trim();

const chapterNumber = (id: string): number => Number(id.replace(Patterns.nonDigits, '')) || 0;

const keepPreviousIds = (
  titles: string[],
  previous: LibraryDocument,
  used: Set<string>
): (string | undefined)[] =>
  titles.map((title, index) => {
    const key = normaliseTitle(title);
    const order = index + 1;

    const candidates = previous.chapters.filter(
      chapter => normaliseTitle(chapter.title) === key && !used.has(chapter.id)
    );

    if (candidates.length === 0) return undefined;
    candidates.sort((left, right) => Math.abs(left.order - order) - Math.abs(right.order - order));
    used.add(candidates[0].id);

    return candidates[0].id;
  });

/**
 * Gives every chapter a stable id, reusing the previous import's ids where titles match.
 *
 * @remarks
 * On a first import chapters are numbered `ch-001…`. On re-import a chapter keeps the id of the
 * old chapter with the same normalised title (the nearest order wins for duplicate titles);
 * new chapters get numbers above the old maximum.
 *
 * @param titles - Chapter titles in reading order.
 * @param previous - The document as it was before a re-import, if any.
 * @returns One chapter id per title.
 */
export const assignChapterIds = (titles: string[], previous?: LibraryDocument): string[] => {
  if (!previous) return titles.map((_title, index) => chapterId(index + 1));
  const used = new Set<string>();
  const ids = keepPreviousIds(titles, previous, used);
  let next = Math.max(0, ...previous.chapters.map(chapter => chapterNumber(chapter.id))) + 1;

  return ids.map(id => {
    if (id) return id;
    while (used.has(chapterId(next))) next++;
    used.add(chapterId(next));

    return chapterId(next++);
  });
};

/**
 * A file copied into the document folder: `relative` is its path there, filled either from the
 * absolute path `from` or from `content`.
 */
export type SourceFileCopy = {
  content?: string | Buffer;
  from?: string;
  relative: string;
};

/** Everything an importer hands over to be written as a library document. */
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
  sourceFiles: SourceFileCopy[];
  title: string;
  warnings: Warning[];
};

const createBuildDir = async (documentId: string): Promise<string> => {
  const buildDir = path.join(libraryDir(), `.build-${documentId}-${Date.now()}`);

  for (const subfolder of BuildSubfolders) {
    await mkdir(path.join(buildDir, subfolder), { recursive: true });
  }

  return buildDir;
};

const uniqueChapterFileName = (order: number, title: string, used: Set<string>): string => {
  let file = chapterFileName(order, title);

  while (used.has(file)) file = file.replace(Patterns.chapterFileExtension, '-x.md');
  used.add(file);

  return file;
};

const chapterSizeWarnings = (chapter: FinishedChapter, wordCount: number): Warning[] => {
  const warnings: Warning[] = [];

  if (chapter.matter === 'body' && wordCount < SHORT_CHAPTER_WORDS) {
    warnings.push({
      chapterId: chapter.id,
      code: 'short-chapter',
      message: `"${chapter.title}" has only ${wordCount} words`,
    });
  }

  if (wordCount > LONG_CHAPTER_WORDS) {
    warnings.push({
      chapterId: chapter.id,
      code: 'long-chapter',
      message: `"${chapter.title}" has ${wordCount} words; consider splitting it`,
    });
  }

  return warnings;
};

const writeChapters = async (
  buildDir: string,
  input: WriteInput,
  warnings: Warning[]
): Promise<ChapterEntry[]> => {
  const entries: ChapterEntry[] = [];
  const usedFiles = new Set<string>();

  for (const [index, chapter] of input.chapters.entries()) {
    const order = index + 1;
    const file = uniqueChapterFileName(order, chapter.title, usedFiles);
    const body = chapter.markdown.trim() || EMPTY_CHAPTER_BODY;

    const front = {
      document: input.id,
      id: chapter.id,
      order,
      title: chapter.title,
    };

    await writeFile(path.join(buildDir, file), buildChapterFile(front, body));
    const wordCount = countWords(body);

    entries.push({
      contentHash: contentHash(body),
      depth: chapter.depth,
      file,
      id: chapter.id,
      matter: chapter.matter,
      order,
      title: chapter.title,
      wordCount,
      ...(chapter.sourceUrl ? { sourceUrl: chapter.sourceUrl } : {}),
    });
    warnings.push(...chapterSizeWarnings(chapter, wordCount));
  }

  return entries;
};

const writeAssets = async (buildDir: string, assets: AssetStore): Promise<void> => {
  for (const [name, data] of assets.files) {
    await writeFile(path.join(buildDir, 'assets', name), data);
  }
};

const writeSourceFiles = async (buildDir: string, sourceFiles: SourceFileCopy[]): Promise<void> => {
  for (const sourceFile of sourceFiles) {
    const target = path.join(buildDir, sourceFile.relative);

    await mkdir(path.dirname(target), { recursive: true });
    if (sourceFile.from) await copyFile(sourceFile.from, target);
    else if (sourceFile.content !== undefined) await writeFile(target, sourceFile.content);
  }
};

const buildLibraryDocument = (input: WriteInput, entries: ChapterEntry[]): LibraryDocument => ({
  authors: input.authors,
  id: input.id,
  kind: input.kind,
  title: input.title,
  ...(input.language ? { language: input.language } : {}),
  ...(input.description ? { description: input.description } : {}),
  source: input.source,
  ...(input.cover ? { cover: input.cover } : {}),
  chapters: entries,
});

const buildImportReport = (
  input: WriteInput,
  entries: ChapterEntry[],
  warnings: Warning[]
): ImportReport => ({
  chapterCount: entries.length,
  chapters: entries.map(entry => ({
    id: entry.id,
    matter: entry.matter,
    title: entry.title,
    wordCount: entry.wordCount,
  })),
  createdAt: new Date().toISOString(),
  documentId: input.id,
  importer: input.importer,
  totalWords: entries.reduce((total, entry) => total + entry.wordCount, 0),
  warnings,
});

/**
 * Writes a converted document into the library, replacing any previous version atomically.
 *
 * @remarks
 * Everything is assembled in a `.build-…` folder (chapters, assets, source files,
 * `document.json`, `import-report.json`) that then replaces the document folder. Short body
 * chapters and very long chapters add warnings to the report.
 *
 * @param input - Converted chapters, assets, metadata and source files of the document.
 * @returns The document as written and its import report.
 */
export const writeLibraryDocument = async (
  input: WriteInput
): Promise<{ doc: LibraryDocument; report: ImportReport }> => {
  const buildDir = await createBuildDir(input.id);
  const warnings = [...input.warnings];
  const entries = await writeChapters(buildDir, input, warnings);

  await writeAssets(buildDir, input.assets);
  await writeSourceFiles(buildDir, input.sourceFiles);

  const doc = buildLibraryDocument(input, entries);

  await writeDocument(doc, buildDir);

  const report = buildImportReport(input, entries, warnings);
  const reportJson = JSON.stringify(report, null, JSON_INDENT) + '\n';

  await writeFile(path.join(buildDir, 'import-report.json'), reportJson);
  await replaceDocumentDir(input.id, buildDir);

  return { doc, report };
};

const footnoteDefinition = (note: string, index: number): string => {
  const [firstLine = '', ...continuation] = note.trim().split('\n');

  const indented = continuation
    .map(line => (line ? `\n${FOOTNOTE_CONTINUATION_INDENT}${line}` : '\n'))
    .join('');

  return `[^${index + 1}]: ${firstLine}${indented}`;
};

/**
 * Appends Markdown footnote definitions (`[^1]: …`) to a chapter body.
 *
 * @param markdown - Chapter body whose references `[^1]`, `[^2]`… point at the notes.
 * @param notes - Markdown of each note, in reference order.
 * @returns The body followed by one definition per note, continuation lines indented.
 */
export const appendFootnotes = (markdown: string, notes: string[]): string => {
  if (notes.length === 0) return markdown;
  const definitions = notes.map(footnoteDefinition);

  return `${markdown.trimEnd()}\n\n${definitions.join('\n\n')}\n`;
};

/**
 * Cleans converter output: LF line endings, no stray `<span>` tags, no non-breaking spaces or
 * byte-order marks, no trailing spaces, at most one blank line in a row.
 *
 * @param markdown - Markdown produced by Pandoc or Defuddle.
 * @returns The tidied Markdown, trimmed.
 */
export const tidyMarkdown = (markdown: string): string =>
  markdown
    .replace(Patterns.carriageReturnLineFeed, '\n')
    .replace(Patterns.spanTag, '')
    .replace(Patterns.nonBreakingSpace, ' ')
    .replace(Patterns.byteOrderMark, '')
    .replace(Patterns.trailingSpacesAndTabs, '')
    .replace(Patterns.excessBlankLines, '\n\n')
    .trim();
