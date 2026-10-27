import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { documentDir, readDocument } from '@study/core';
import { indexDocument } from '@study/core/db';

import { importHtmlFile, importUrl } from './import-article';
import { importEpubFile, importKindleFile } from './import-epub';
import { importMarkdownFile } from './import-markdown';
import { importLogger, type ImportOptions, type ImportResult } from './import-options';
import { Patterns } from './patterns';

export { isMobiEncrypted } from './calibre';
export { DocumentExistsError, type ImportOptions, type ImportResult } from './import-options';
export { MissingToolError } from './tools';
export type { Fetcher } from './url';

const REIMPORT_DIR_PREFIX = 'study-reimport-';

type FileImporter = (file: string, opts: ImportOptions) => Promise<ImportResult>;

const FileImporters = new Map<string, FileImporter>([
  ['.epub', (file, opts) => importEpubFile(file, opts)],
  ['.mobi', importKindleFile],
  ['.azw', importKindleFile],
  ['.azw3', importKindleFile],
  ['.prc', importKindleFile],
  ['.html', importHtmlFile],
  ['.htm', importHtmlFile],
  ['.md', importMarkdownFile],
  ['.markdown', importMarkdownFile],
]);

/**
 * Tells whether an import input is a web address rather than a file path.
 *
 * @param input - File path or URL given to {@link importSource}.
 * @returns True for `http://` and `https://` URLs (any case).
 */
export const isUrl = (input: string): boolean => Patterns.httpUrl.test(input);

const importFile = (file: string, opts: ImportOptions): Promise<ImportResult> => {
  const extension = path.extname(file).toLowerCase();

  if (!existsSync(file)) throw new Error(`File not found: ${file}`);
  const importer = FileImporters.get(extension);

  if (importer) return importer(file, opts);

  if (extension === '.pdf') {
    throw new Error('PDF import is planned for v0.3 and not supported yet.');
  }

  throw new Error(
    `Unsupported file type "${extension}". Supported: .epub, .mobi, .azw, .azw3, .html, .md, or an http(s) URL.`
  );
};

/**
 * Imports an EPUB/MOBI/AZW file, a saved `.html` page, a Markdown file or a web URL into the
 * library.
 *
 * @param input - File path or `http(s)` URL.
 * @param opts - Import options (document id, TOC depth, database to index in, logger…).
 * @returns The imported document and its import report.
 * @throws An `Error` for missing files, unsupported types, DRM-protected books and failed
 * downloads; {@link DocumentExistsError} when the id is taken; {@link MissingToolError} when
 * Pandoc or Calibre is missing.
 */
export const importSource = async (
  input: string,
  opts: ImportOptions = {}
): Promise<ImportResult> => {
  const log = importLogger(opts);
  const result = isUrl(input) ? await importUrl(input, opts) : await importFile(input, opts);
  const { document } = result;

  if (opts.db) {
    log('Indexing in PostgreSQL…');
    await indexDocument(opts.db, document.id);
  }

  log(`Imported "${document.title}" as ${document.id} with ${document.chapters.length} chapters.`);

  return result;
};

const importFromCopyOutsideDocumentFolder = async (
  file: string,
  opts: ImportOptions
): Promise<ImportResult> => {
  const copyDir = await mkdtemp(path.join(os.tmpdir(), REIMPORT_DIR_PREFIX));

  try {
    const copy = path.join(copyDir, path.basename(file));

    await copyFile(file, copy);

    return await importSource(copy, opts);
  } finally {
    await rm(copyDir, { force: true, recursive: true });
  }
};

/**
 * Re-runs the import from the saved source, keeping the document id and matching chapter ids.
 *
 * @remarks
 * Web documents are fetched again from their URL. File sources are copied out first, because
 * the import replaces the document folder that holds them.
 *
 * @param docId - Id of the document to re-import.
 * @param opts - Import options other than `id` and `previous`.
 * @returns The re-imported document and its import report.
 * @throws The same errors as {@link importSource}, and an `Error` when the document is missing.
 */
export const reimportDocument = async (
  docId: string,
  opts: Omit<ImportOptions, 'previous' | 'id'> = {}
): Promise<ImportResult> => {
  const previous = await readDocument(docId);
  const next = { ...opts, previous };
  const { source } = previous;

  if (source.type === 'url' || source.type === 'docs') return importSource(source.url, next);

  return importFromCopyOutsideDocumentFolder(path.join(documentDir(docId), source.file), next);
};
