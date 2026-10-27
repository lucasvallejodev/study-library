import { Patterns } from './patterns';

const HEADING_MARKER = '#';

const isWhitespace = (character: string): boolean => character.trim() === '';

const isHeadingMarker = (character: string): boolean => character === HEADING_MARKER;

const isLineTerminator = (character: string): boolean => Patterns.lineTerminator.test(character);

const blankHeadingText = (afterMarker: string): string | undefined =>
  [...afterMarker.slice(1)].reverse().find(character => !isLineTerminator(character));

const dropLeadingKeepingOne = (
  text: string,
  shouldDrop: (character: string) => boolean
): string => {
  let start = 0;

  while (start < text.length - 1 && shouldDrop(text.charAt(start))) start++;

  return text.slice(start);
};

const dropTrailingKeepingOne = (
  text: string,
  shouldDrop: (character: string) => boolean
): string => {
  let end = text.length;

  while (end > 1 && shouldDrop(text.charAt(end - 1))) end--;

  return text.slice(0, end);
};

/**
 * Collapses every run of whitespace into one space and trims the ends.
 *
 * @param text - Text as found in a DOM node or HTML fragment.
 * @returns The text on one line with single spaces.
 */
export const collapseWhitespace = (text: string): string =>
  text.replace(Patterns.whitespaceRun, ' ').trim();

/**
 * Removes every `<…>` tag from an HTML fragment, leaving the text between tags.
 *
 * @remarks
 * Matches the classic `/<[^>]+>/g` replacement (a tag runs from `<` to the first `>` after it
 * and holds at least one character) without its quadratic backtracking on unclosed `<`.
 *
 * @param html - HTML fragment or text that may contain tags.
 * @returns The text with the tags removed.
 */
export const stripHtmlTags = (html: string): string => {
  let text = '';
  let copiedUpTo = 0;
  let open = html.indexOf('<');

  while (open !== -1) {
    const close = html.indexOf('>', open + 1);

    if (close === -1) break;
    const isEmptyTag = close === open + 1;

    if (!isEmptyTag) {
      text += html.slice(copiedUpTo, open);
      copiedUpTo = close + 1;
    }

    open = html.indexOf('<', isEmptyTag ? open + 1 : close + 1);
  }

  return text + html.slice(copiedUpTo);
};

/**
 * Reads the text of an ATX Markdown heading of exactly the given level (`## Title ##`).
 *
 * @remarks
 * Same result as `/^#{level}\s+(.+?)\s*#*$/` (leading whitespace and the optional closing
 * hashes are dropped, at least one character is kept, the text never holds a line break),
 * computed without the regular expression's super-linear backtracking.
 *
 * @param line - One line of Markdown.
 * @param level - Number of `#` characters that open the heading.
 * @returns The heading text, or `undefined` when the line is not a heading of that level.
 */
export const atxHeadingText = (line: string, level: number): string | undefined => {
  if (!line.startsWith(HEADING_MARKER.repeat(level))) return undefined;
  const afterMarker = line.slice(level);
  const hasSpaceAndText = afterMarker.length > 1 && isWhitespace(afterMarker.charAt(0));

  if (!hasSpaceAndText) return undefined;
  if (afterMarker.trim() === '') return blankHeadingText(afterMarker);
  const withoutIndent = dropLeadingKeepingOne(afterMarker, isWhitespace);
  const withoutClosingHashes = dropTrailingKeepingOne(withoutIndent, isHeadingMarker);
  const text = dropTrailingKeepingOne(withoutClosingHashes, isWhitespace);

  return Patterns.lineTerminator.test(text) ? undefined : text;
};

/**
 * Collects the targets of every image in a Markdown text, both `![alt](target "title")` and
 * raw `<img src="target">`.
 *
 * @param markdown - Markdown that may contain images.
 * @returns The distinct image targets, as written.
 */
export const imageReferences = (markdown: string): Set<string> => {
  const references = new Set<string>();

  for (const match of markdown.matchAll(Patterns.markdownImageTarget)) references.add(match[1]);
  for (const match of markdown.matchAll(Patterns.htmlImageSource)) references.add(match[1]);

  return references;
};
