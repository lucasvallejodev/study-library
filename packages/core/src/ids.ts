import { randomBytes } from 'node:crypto';

import { Patterns } from './patterns';

const DEFAULT_SLUG_LENGTH = 60;
const CHAPTER_FILE_SLUG_LENGTH = 50;
const ORDER_DIGITS = 3;
const ANNOTATION_ID_BYTES = 6;
const ANNOTATION_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const UNTITLED_SLUG = 'untitled';

const padOrder = (order: number): string => String(order).padStart(ORDER_DIGITS, '0');

/**
 * Turns any title into a URL-safe slug of lowercase letters, digits and single dashes.
 *
 * @remarks
 * Accents are folded to their base letter and apostrophes dropped (`Alice’s` becomes
 * `alices`). The slug never starts or ends with a dash, even after truncation.
 *
 * @param input - Free text such as a book or chapter title.
 * @param maxLength - Maximum number of characters of the slug.
 * @returns The slug, or `untitled` when nothing usable is left.
 */
export const slugify = (input: string, maxLength = DEFAULT_SLUG_LENGTH): string => {
  const slug = input
    .normalize('NFKD')
    .replace(Patterns.combiningDiacritics, '')
    .toLowerCase()
    .replace(Patterns.apostrophes, '')
    .replace(Patterns.nonSlugRun, '-')
    .replace(Patterns.edgeDash, '')
    .slice(0, maxLength)
    .replace(Patterns.trailingDash, '');

  return slug || UNTITLED_SLUG;
};

/**
 * Builds the stable id of a chapter from its position.
 *
 * @remarks
 * Chapter ids are `ch-001`, `ch-002`... assigned once and kept across re-imports.
 *
 * @param position - One-based position of the chapter in the document.
 * @returns The chapter id, such as `ch-007`.
 */
export const chapterId = (position: number): string => `ch-${padOrder(position)}`;

/**
 * Builds the path of a chapter file relative to its document folder.
 *
 * @param order - One-based reading order of the chapter.
 * @param title - Chapter title, slugified into the file name.
 * @returns A path such as `chapters/007-down-the-rabbit-hole.md`.
 */
export const chapterFileName = (order: number, title: string): string =>
  `chapters/${padOrder(order)}-${slugify(title, CHAPTER_FILE_SLUG_LENGTH)}.md`;

/**
 * Generates a new random annotation id.
 *
 * @returns An id such as `a-k3x9q0`.
 */
export const annotationId = (): string => {
  const bytes = randomBytes(ANNOTATION_ID_BYTES);
  let id = '';

  for (const byte of bytes) id += ANNOTATION_ID_ALPHABET[byte % ANNOTATION_ID_ALPHABET.length];

  return `a-${id}`;
};
