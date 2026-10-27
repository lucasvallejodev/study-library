import {
  type ImportOptions,
  type ImportResult,
  importTimestamp,
  resolveDocumentId,
} from './import-options';
import { parseMarkdownFile } from './markdown';
import { AssetStore, assignChapterIds, type Warning, writeLibraryDocument } from './writer';

const SAVED_SOURCE_PATH = 'source/original.md';

/**
 * Imports a Markdown file, one chapter per level-1 heading.
 *
 * @param file - Path of the Markdown file.
 * @param opts - Import options.
 * @returns The imported document and its report.
 * @throws An `Error` when the file has no content, and `DocumentExistsError` when the id is
 * taken.
 */
export const importMarkdownFile = async (
  file: string,
  opts: ImportOptions
): Promise<ImportResult> => {
  const warnings: Warning[] = [];
  const assets = new AssetStore();
  const { chapters, meta } = await parseMarkdownFile(file, assets, warnings);

  if (chapters.length === 0) throw new Error('The Markdown file is empty');
  const id = resolveDocumentId(meta.title, opts);

  const ids = assignChapterIds(
    chapters.map(chapter => chapter.title),
    opts.previous
  );

  const { doc, report } = await writeLibraryDocument({
    assets,
    authors: meta.authors,
    chapters: chapters.map((chapter, index) => ({ ...chapter, id: ids[index] })),
    description: meta.description,
    id,
    importer: 'markdown',
    kind: meta.kind ?? 'book',
    source: {
      file: SAVED_SOURCE_PATH,
      importedAt: importTimestamp(),
      type: 'markdown',
      ...(meta.sourceUrl ? { url: meta.sourceUrl } : {}),
    },
    sourceFiles: [{ from: file, relative: SAVED_SOURCE_PATH }],
    title: meta.title,
    warnings,
  });

  return { document: doc, report };
};
