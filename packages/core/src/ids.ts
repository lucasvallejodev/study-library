import { randomBytes } from 'node:crypto';

/**
 *
 * @param input
 * @param maxLength
 */
export const slugify = (input: string, maxLength = 60): string => {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');

  return slug || 'untitled';
};

/**
 * Chapter ids are `ch-001`, `ch-002`... assigned once and kept across re-imports.
 *
 * @param n
 */
export const chapterId = (n: number): string => `ch-${String(n).padStart(3, '0')}`;

/**
 *
 * @param order
 * @param title
 */
export const chapterFileName = (order: number, title: string): string =>
  `chapters/${String(order).padStart(3, '0')}-${slugify(title, 50)}.md`;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 *
 */
export const annotationId = (): string => {
  const bytes = randomBytes(6);
  let id = '';

  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];

  return `a-${id}`;
};
