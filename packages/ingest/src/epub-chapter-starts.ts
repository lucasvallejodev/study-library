import type { ChapterMatter } from '@study/core';

import type { EpubBook } from './epub-book';
import { classifyMatter } from './epub-matter';
import type { TocEntry } from './epub-toc';

const TOP_LEVEL = 1;

/** A point in the book: a spine index plus an optional anchor inside that spine file. */
export type SpinePosition = { fragment?: string; spine: number };

/** A chapter's title, depth and matter, and where it starts; it ends at the next start. */
export type ChapterSlice = {
  depth: number;
  matter: ChapterMatter;
  start: SpinePosition;
  title: string;
};

const isInFileSubSection = (entry: TocEntry): boolean =>
  !!entry.fragment && entry.parentFile === entry.file;

const isAtFileStart = (doc: Document, fragment: string): boolean => {
  const anchor = doc.getElementById(fragment);
  const body = doc.getElementsByTagName('body')[0];

  if (!anchor || !body) return false;
  const before = doc.createRange();

  before.selectNodeContents(body);
  before.setEndBefore(anchor);

  return (
    before.toString().trim().length === 0 && !before.cloneContents().querySelector?.('img,svg')
  );
};

const resolvableFragment = (
  book: EpubBook,
  entry: TocEntry,
  doc: Document | undefined
): string | undefined => {
  const { fragment } = entry;

  if (!fragment) return undefined;

  if (!doc?.getElementById(fragment)) {
    book.warnings.push({
      code: 'unresolved-toc-entry',
      message: `TOC entry "${entry.title}" anchor #${fragment} not found; using file start`,
    });

    return undefined;
  }

  return doc && isAtFileStart(doc, fragment) ? undefined : fragment;
};

const tocEntrySlice = async (
  book: EpubBook,
  entry: TocEntry,
  spine: number
): Promise<ChapterSlice> => {
  const doc = await book.doc(entry.file);
  const fragment = resolvableFragment(book, entry, doc);

  return {
    depth: entry.depth,
    matter: classifyMatter(doc, fragment, entry.title),
    start: { fragment, spine },
    title: entry.title,
  };
};

const spineIndexOf = (
  book: EpubBook,
  entry: TocEntry,
  spineIndex: Map<string, number>
): number | undefined => {
  const spine = spineIndex.get(entry.file);

  if (spine === undefined) {
    book.warnings.push({
      code: 'unresolved-toc-entry',
      message: `TOC entry "${entry.title}" points to ${entry.file}, which is not in the spine`,
    });
  }

  return spine;
};

/**
 * Turns table-of-contents entries into chapter starts.
 *
 * @remarks
 * Entries deeper than `maxDepth` are skipped. In-file sub-sections stay in their parent: an
 * entry anchored inside its parent's file (story parts I, II, III) is not a chapter start. An
 * anchor at the very start of its file counts as the file start, and duplicate starts are
 * dropped. Entries outside the spine or with missing anchors add warnings to the book.
 *
 * @param book - The opened EPUB, which collects the warnings.
 * @param entries - Flattened table of contents.
 * @param maxDepth - Deepest TOC level used as a chapter start.
 * @returns One slice per chapter start, in table-of-contents order.
 */
export const chapterStartsFromToc = async (
  book: EpubBook,
  entries: TocEntry[],
  maxDepth: number
): Promise<ChapterSlice[]> => {
  const spineIndex = new Map(book.spine.map((file, index) => [file, index]));
  const seen = new Set<string>();
  const slices: ChapterSlice[] = [];

  for (const entry of entries) {
    if (entry.depth > maxDepth || isInFileSubSection(entry)) continue;
    const spine = spineIndexOf(book, entry, spineIndex);

    if (spine === undefined) continue;
    const slice = await tocEntrySlice(book, entry, spine);
    const key = `${spine}#${slice.start.fragment ?? ''}`;

    if (seen.has(key)) continue;
    seen.add(key);
    slices.push(slice);
  }

  return slices;
};

const spineFileTitle = (doc: Document | undefined, index: number): string =>
  doc?.querySelector('h1,h2,h3')?.textContent?.trim() ||
  doc?.querySelector('title')?.textContent?.trim() ||
  `Section ${index + 1}`;

/**
 * Makes one chapter per spine file, for books without a usable table of contents.
 *
 * @param book - The opened EPUB.
 * @returns One slice per spine file, titled by its first heading or `<title>`.
 */
export const spineFileSlices = async (book: EpubBook): Promise<ChapterSlice[]> => {
  const slices: ChapterSlice[] = [];

  for (const [index, file] of book.spine.entries()) {
    const doc = await book.doc(file);
    const title = spineFileTitle(doc, index);

    slices.push({
      depth: TOP_LEVEL,
      matter: classifyMatter(doc, undefined, title),
      start: { spine: index },
      title,
    });
  }

  return slices;
};
