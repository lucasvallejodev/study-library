import type { EpubBook } from './epub-book';
import {
  type ChapterSlice,
  chapterStartsFromToc,
  spineFileSlices,
  type SpinePosition,
} from './epub-chapter-starts';
import { readTableOfContents, type TocEntry } from './epub-toc';
import { Patterns } from './patterns';

const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MAX_PART_PAGE_WORDS = 30;
const TOP_LEVEL = 1;
const FRONT_MATTER_TITLE = 'Front matter';

/** How the spine is split: `tocDepth` is the deepest TOC level used as a chapter start (default: all). */
export type EpubParseOptions = { tocDepth?: number };

/**
 * A chapter before conversion: its slice plus `parts`, one container element per spine file it
 * touches, each holding a copy of the chapter's nodes from that file (`data-file` names it).
 */
export type EpubChapterDraft = ChapterSlice & { parts: Element[] };

type SpineRange = { end: SpinePosition; start: SpinePosition };

const partsText = (parts: Element[]): string => parts.map(part => part.textContent ?? '').join(' ');

const hasMedia = (parts: Element[]): boolean =>
  parts.some(part => part.querySelector('img, svg, image'));

const hasContent = (parts: Element[]): boolean =>
  partsText(parts).trim().length > 0 || hasMedia(parts);

const wordCount = (parts: Element[]): number =>
  partsText(parts).split(Patterns.whitespaceRun).filter(Boolean).length;

const anchorInSpineFile = (
  doc: Document,
  spine: number,
  position: SpinePosition
): Element | null =>
  spine === position.spine && position.fragment ? doc.getElementById(position.fragment) : null;

const cloneSpineFileSlice = async (
  book: EpubBook,
  spine: number,
  range: SpineRange
): Promise<Element | undefined> => {
  const file = book.spine[spine];
  const doc = await book.doc(file);
  const body = doc?.getElementsByTagName('body')[0];

  if (!doc || !body) return undefined;
  const domRange = doc.createRange();

  domRange.selectNodeContents(body);
  const startAnchor = anchorInSpineFile(doc, spine, range.start);

  if (startAnchor) domRange.setStartBefore(startAnchor);
  const endAnchor = anchorInSpineFile(doc, spine, range.end);

  if (endAnchor) domRange.setEndBefore(endAnchor);
  const container = doc.createElementNS(XHTML_NAMESPACE, 'div');

  container.setAttribute('data-file', file);
  container.appendChild(domRange.cloneContents());

  return container;
};

const cloneRangeAcrossSpineFiles = async (
  book: EpubBook,
  range: SpineRange
): Promise<Element[]> => {
  const parts: Element[] = [];
  const endsInsideFile = !!range.end.fragment;
  const lastSpine = endsInsideFile ? range.end.spine : range.end.spine - 1;

  for (let spine = range.start.spine; spine <= lastSpine && spine < book.spine.length; spine++) {
    const part = await cloneSpineFileSlice(book, spine, range);

    if (part) parts.push(part);
  }

  return parts;
};

const inSpineOrder = (book: EpubBook, slices: ChapterSlice[]): ChapterSlice[] => {
  const ordered = [...slices].sort((left, right) => left.start.spine - right.start.spine);

  if (ordered.some((slice, index) => slice !== slices[index])) {
    book.warnings.push({
      code: 'other',
      message: 'TOC order differs from spine order; chapters follow the spine',
    });
  }

  return ordered;
};

const frontMatterDrafts = async (
  book: EpubBook,
  firstChapter: ChapterSlice | undefined
): Promise<EpubChapterDraft[]> => {
  const bookStart: SpinePosition = { spine: 0 };

  if (!firstChapter) return [];
  const startsAtBookStart = firstChapter.start.spine === 0 && !firstChapter.start.fragment;

  if (startsAtBookStart) return [];

  const parts = await cloneRangeAcrossSpineFiles(book, {
    end: firstChapter.start,
    start: bookStart,
  });

  if (!hasContent(parts)) return [];

  return [
    {
      depth: TOP_LEVEL,
      matter: 'front',
      parts,
      start: bookStart,
      title: FRONT_MATTER_TITLE,
    },
  ];
};

const chapterDrafts = async (
  book: EpubBook,
  ordered: ChapterSlice[]
): Promise<EpubChapterDraft[]> => {
  const drafts: EpubChapterDraft[] = [];
  const bookEnd: SpinePosition = { spine: book.spine.length };

  for (const [index, slice] of ordered.entries()) {
    const end = ordered[index + 1]?.start ?? bookEnd;

    drafts.push({
      ...slice,
      parts: await cloneRangeAcrossSpineFiles(book, { end, start: slice.start }),
    });
  }

  return drafts;
};

const isTitleOnlyPartPage = (draft: EpubChapterDraft, partTitles: Set<string>): boolean =>
  partTitles.has(draft.title) &&
  wordCount(draft.parts) <= MAX_PART_PAGE_WORDS &&
  !hasMedia(draft.parts) &&
  draft.matter === 'body';

const foldTitleOnlyPartPages = (
  drafts: EpubChapterDraft[],
  entries: TocEntry[]
): EpubChapterDraft[] => {
  const partTitles = new Set(entries.filter(entry => entry.hasChildren).map(entry => entry.title));
  const folded: EpubChapterDraft[] = [];

  for (const [index, draft] of drafts.entries()) {
    const next = drafts[index + 1];

    if (next && isTitleOnlyPartPage(draft, partTitles)) {
      next.parts = [...draft.parts, ...next.parts];
      continue;
    }

    folded.push(draft);
  }

  return folded;
};

/**
 * Splits the spine into chapters following the table of contents.
 *
 * @remarks
 * A chapter is every node in spine order from its start to the next chapter's start, cut with
 * DOM ranges across spine files. Content before the first chapter becomes a "Front matter"
 * chapter; without a usable TOC every spine file is a chapter (with a `no-toc` warning).
 * Chapters follow the spine even when the TOC lists them in another order. Title-only part
 * pages fold forward: a body part page ("Book One") with TOC children, at most 30 words and no
 * images is merged into the chapter after it.
 *
 * @param book - The opened EPUB, which collects the warnings.
 * @param opts - Deepest TOC level used as a chapter start.
 * @returns The chapter drafts in reading order.
 */
export const sliceChapters = async (
  book: EpubBook,
  opts: EpubParseOptions = {}
): Promise<EpubChapterDraft[]> => {
  const entries = await readTableOfContents(book);

  if (entries.length === 0) {
    book.warnings.push({
      code: 'no-toc',
      message: 'No usable table of contents; one chapter per spine item',
    });
  }

  const tocSlices = await chapterStartsFromToc(book, entries, opts.tocDepth ?? Infinity);
  const slices = tocSlices.length ? tocSlices : await spineFileSlices(book);
  const ordered = inSpineOrder(book, slices);
  const frontMatter = await frontMatterDrafts(book, ordered[0]);
  const chapters = await chapterDrafts(book, ordered);

  return foldTitleOnlyPartPages([...frontMatter, ...chapters], entries);
};
