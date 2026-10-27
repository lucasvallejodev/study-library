import type { EpubBook } from './epub-book';
import { cleanHtml, epubTypes, newHtmlDocument } from './html';
import { Patterns } from './patterns';

const NoteReferenceTypes = new Set(['noteref', 'doc-noteref']);

const BacklinkTypes = new Set(['backlink', 'doc-backlink']);

const NoteWrapperElements = new Set(['li', 'aside']);

/**
 * Tells whether a link is a note reference (`epub:type="noteref"` or `role="doc-noteref"`).
 *
 * @param link - Anchor element in a chapter.
 * @returns True when the link points at a footnote or endnote.
 */
export const isNoteReference = (link: Element): boolean =>
  epubTypes(link).some(type => NoteReferenceTypes.has(type));

/**
 * Tells whether a link leads from a note back to its reference (`↩`).
 *
 * @param link - Anchor element in a chapter or note.
 * @returns True for `epub:type="backlink"` and `role="doc-backlink"` links.
 */
export const isBacklink = (link: Element): boolean =>
  epubTypes(link).some(type => BacklinkTypes.has(type));

const isArrowBacklink = (link: Element): boolean =>
  Patterns.noteBacklinkArrow.test(link.textContent?.trim() ?? '');

/**
 * Plain-text stand-in for a note reference while the chapter goes through Pandoc.
 *
 * @remarks
 * Pandoc would escape a literal `[^n]`; this token passes through untouched and
 * {@link restoreFootnoteReferences} turns it into the Markdown reference afterwards.
 *
 * @param noteNumber - 1-based number of the note in the chapter.
 * @returns The placeholder text.
 */
export const footnotePlaceholder = (noteNumber: number): string => `FNREFTOKEN${noteNumber}X`;

/**
 * Replaces every {@link footnotePlaceholder} in converted Markdown with a `[^n]` reference.
 *
 * @param markdown - Markdown produced by Pandoc.
 * @returns The Markdown with footnote references.
 */
export const restoreFootnoteReferences = (markdown: string): string =>
  markdown.replace(Patterns.footnotePlaceholder, '[^$1]');

/**
 * Reads the HTML of a note, usually from the book's endnotes file.
 *
 * @remarks
 * Back-links are dropped, and a note held in an `<li>` or `<aside>` contributes its content
 * without the wrapper.
 *
 * @param book - The opened EPUB.
 * @param file - Archive path of the file that holds the note.
 * @param id - Element id of the note.
 * @returns The cleaned HTML of the note, or `undefined` when it cannot be found.
 */
export const footnoteHtml = async (
  book: EpubBook,
  file: string,
  id: string
): Promise<string | undefined> => {
  const doc = await book.doc(file);
  const note = doc?.getElementById(id);

  if (!note) return undefined;
  const clone = note.cloneNode(true) as Element;

  for (const link of Array.from(clone.querySelectorAll('a'))) {
    if (isBacklink(link) || isArrowBacklink(link)) link.remove();
  }

  const htmlDocument = newHtmlDocument();
  const container = htmlDocument.createElement('div');
  const nodes = NoteWrapperElements.has(clone.localName) ? Array.from(clone.childNodes) : [clone];

  container.append(...nodes.map(node => htmlDocument.importNode(node, true)));
  cleanHtml(container);

  return container.innerHTML;
};
