import type { EpubBook } from './epub-book';
import {
  type EpubHref,
  type NcxDocument,
  type NcxNavPoint,
  resolveHref,
  xmlParser,
  xmlText,
} from './epub-xml';
import { epubTypes } from './html';
import { collapseWhitespace } from './text';

const UNTITLED = 'Untitled';
const TOP_LEVEL = 1;

/** One table-of-contents entry, flattened with its nesting depth. */
export type TocEntry = EpubHref & {
  depth: number;
  hasChildren: boolean;
  parentFile?: string;
  title: string;
};

type TocLevel = { depth: number; parentFile?: string };

const isList = (element: Element): boolean =>
  element.localName === 'ol' || element.localName === 'ul';

const childElements = (element: Element): Element[] => Array.from(element.children);

const navListEntries = (list: Element, navPath: string, level: TocLevel): TocEntry[] =>
  childElements(list)
    .filter(child => child.localName === 'li')
    .flatMap(item => {
      const label = childElements(item).find(
        child => child.localName === 'a' || child.localName === 'span'
      );

      const subList = childElements(item).find(isList);
      const href = label?.getAttribute('href');
      const target = href ? resolveHref(href, navPath) : undefined;

      const entry: TocEntry[] = target
        ? [
            {
              ...target,
              depth: level.depth,
              hasChildren: !!subList,
              parentFile: level.parentFile,
              title: collapseWhitespace(label?.textContent ?? '') || UNTITLED,
            },
          ]
        : [];

      const children = subList
        ? navListEntries(subList, navPath, { depth: level.depth + 1, parentFile: target?.file })
        : [];

      return [...entry, ...children];
    });

const readNavToc = async (book: EpubBook): Promise<TocEntry[]> => {
  if (!book.navPath) return [];
  const nav = await book.doc(book.navPath);

  const tocNav =
    nav &&
    Array.from(nav.getElementsByTagName('nav')).find(element => epubTypes(element).includes('toc'));

  const list = tocNav ? childElements(tocNav).find(isList) : undefined;

  return list ? navListEntries(list, book.navPath, { depth: TOP_LEVEL }) : [];
};

const ncxEntries = (
  points: NcxNavPoint[] | undefined,
  ncxPath: string,
  level: TocLevel
): TocEntry[] =>
  (points ?? []).flatMap(point => {
    const source = point.content?.['@_src'];
    const children = point.navPoint;
    const target = source ? resolveHref(source, ncxPath) : undefined;

    const entry: TocEntry[] = target
      ? [
          {
            ...target,
            depth: level.depth,
            hasChildren: !!children?.length,
            parentFile: level.parentFile,
            title: xmlText(point.navLabel?.text) || UNTITLED,
          },
        ]
      : [];

    const nested = ncxEntries(children, ncxPath, {
      depth: level.depth + 1,
      parentFile: target?.file,
    });

    return [...entry, ...nested];
  });

const readNcxToc = async (book: EpubBook): Promise<TocEntry[]> => {
  if (!book.ncxPath) return [];
  const raw = await book.text(book.ncxPath);

  if (!raw) return [];
  const ncx = (xmlParser.parse(raw) as NcxDocument).ncx;

  return ncxEntries(ncx?.navMap?.navPoint, book.ncxPath, { depth: TOP_LEVEL });
};

/**
 * Reads the table of contents, flattened in reading order with each entry's depth.
 *
 * @remarks
 * Uses the EPUB 3 `nav[epub:type~=toc]` when it has entries, else the EPUB 2 NCX.
 *
 * @param book - The opened EPUB.
 * @returns The entries, or an empty list when the book has no usable table of contents.
 */
export const readTableOfContents = async (book: EpubBook): Promise<TocEntry[]> => {
  const navEntries = await readNavToc(book);

  return navEntries.length ? navEntries : readNcxToc(book);
};
