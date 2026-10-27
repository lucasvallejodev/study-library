import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { convertToEpub } from './calibre';
import { convertEpub, EpubBook, sliceChapters } from './epub';
import {
  importLogger,
  type ImportOptions,
  type ImportResult,
  importTimestamp,
  resolveDocumentId,
} from './import-options';
import { AssetStore, assignChapterIds, writeLibraryDocument } from './writer';

const CONVERSION_DIR_PREFIX = 'study-lib-';
const CONVERTED_FILE_NAME = 'converted.epub';
const DEFAULT_EBOOK_EXTENSION = '.epub';
const MOBIPOCKET_EXTENSION = 'prc';

/** Source formats that go through the EPUB importer. */
export type EbookSourceType = 'epub' | 'mobi' | 'azw' | 'azw3';

type KindleSourceType = Exclude<EbookSourceType, 'epub'>;

const importCover = async (book: EpubBook, assets: AssetStore): Promise<string | undefined> => {
  const { coverPath } = book.metadata;

  if (!coverPath) return undefined;
  const data = await book.file(coverPath);

  return data ? assets.add(data, path.extname(coverPath).slice(1)) : undefined;
};

const importerName = (sourceType: EbookSourceType): string =>
  sourceType === 'epub' ? 'epub' : `${sourceType}->epub (calibre)`;

/**
 * Imports an EPUB file: slices it into chapters following the TOC and converts them with Pandoc.
 *
 * @param file - Path of the EPUB to read.
 * @param opts - Import options.
 * @param sourceType - Format the user imported (a Kindle file arrives here converted to EPUB).
 * @param originalFile - The file the user imported, kept as the document's source.
 * @returns The imported document and its report.
 * @throws An `Error` when the file is not an EPUB or is DRM-protected, and
 * `DocumentExistsError` when the id is taken.
 */
export const importEpubFile = async (
  file: string,
  opts: ImportOptions,
  sourceType: EbookSourceType = 'epub',
  originalFile = file
): Promise<ImportResult> => {
  const log = importLogger(opts);

  log(`Reading ${path.basename(originalFile)}…`);
  const book = await EpubBook.load(await readFile(file));
  const id = resolveDocumentId(book.metadata.title, opts);
  const drafts = await sliceChapters(book, { tocDepth: opts.tocDepth });

  log(`Found ${drafts.length} chapters; converting with Pandoc…`);

  const ids = assignChapterIds(
    drafts.map(draft => draft.title),
    opts.previous
  );

  const assets = new AssetStore();

  const chapters = await convertEpub({
    assets,
    book,
    docId: id,
    drafts,
    ids,
  });

  const cover = await importCover(book, assets);
  const extension = path.extname(originalFile).toLowerCase() || DEFAULT_EBOOK_EXTENSION;
  const sourceRelative = `source/original${extension}`;

  const { doc, report } = await writeLibraryDocument({
    assets,
    authors: book.metadata.authors,
    chapters,
    cover,
    description: book.metadata.description,
    id,
    importer: importerName(sourceType),
    kind: 'book',
    language: book.metadata.language,
    source: {
      file: sourceRelative,
      importedAt: importTimestamp(),
      type: sourceType,
    },
    sourceFiles: [{ from: originalFile, relative: sourceRelative }],
    title: book.metadata.title,
    warnings: book.warnings,
  });

  return { document: doc, report };
};

const kindleSourceType = (file: string): KindleSourceType => {
  const extension = path.extname(file).toLowerCase().slice(1);

  return (extension === MOBIPOCKET_EXTENSION ? 'mobi' : extension) as KindleSourceType;
};

/**
 * Imports a MOBI/AZW/AZW3/PRC file by converting it to EPUB with Calibre first.
 *
 * @param file - Path of the Kindle file.
 * @param opts - Import options.
 * @returns The imported document and its report; the original file is kept as its source.
 * @throws An `Error` when the file is DRM-protected or the conversion fails, and
 * `MissingToolError` when Calibre is not installed.
 */
export const importKindleFile = async (
  file: string,
  opts: ImportOptions
): Promise<ImportResult> => {
  const log = importLogger(opts);
  const sourceType = kindleSourceType(file);
  const conversionDir = await mkdtemp(path.join(os.tmpdir(), CONVERSION_DIR_PREFIX));

  try {
    const epub = path.join(conversionDir, CONVERTED_FILE_NAME);

    log('Converting with Calibre (ebook-convert)…');
    await convertToEpub(file, epub);

    return await importEpubFile(epub, opts, sourceType, file);
  } finally {
    await rm(conversionDir, { force: true, recursive: true });
  }
};
