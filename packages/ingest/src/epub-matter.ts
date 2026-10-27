import type { ChapterMatter } from '@study/core';

import { epubTypes } from './html';
import { Patterns } from './patterns';

const BackMatterTypes = new Set([
  'backmatter',
  'endnotes',
  'doc-endnotes',
  'colophon',
  'copyright-page',
]);

const FrontMatterTypes = new Set(['frontmatter', 'titlepage', 'imprint', 'cover', 'halftitlepage']);

const startTypes = (doc: Document, fragment: string | undefined): Set<string> => {
  const body = doc.getElementsByTagName('body')[0];
  const start = fragment ? doc.getElementById(fragment) : body?.firstElementChild;
  const firstSection = body?.querySelector('section');

  return new Set([...epubTypes(body), ...epubTypes(start), ...epubTypes(firstSection)]);
};

const hasAny = (types: Set<string>, wanted: Set<string>): boolean =>
  [...wanted].some(type => types.has(type));

const matterFromTitle = (title: string): ChapterMatter => {
  if (!Patterns.matterPageTitle.test(title)) return 'body';

  return Patterns.backMatterPageTitle.test(title) ? 'back' : 'front';
};

/**
 * Classifies a chapter as front, body or back matter.
 *
 * @remarks
 * Reads the `epub:type`/`role` of the body, of the chapter's first element and of the first
 * `<section>` (`frontmatter`, `backmatter`, `titlepage`, `colophon`, `endnotes`…), then falls back
 * to well-known page titles ("Title Page", "Colophon", "Contents"…).
 *
 * @param doc - Content file the chapter starts in, if it could be read.
 * @param fragment - Anchor the chapter starts at inside the file, if any.
 * @param title - Chapter title from the table of contents.
 * @returns The chapter's matter.
 */
export const classifyMatter = (
  doc: Document | undefined,
  fragment: string | undefined,
  title: string
): ChapterMatter => {
  const types = doc ? startTypes(doc, fragment) : new Set<string>();

  if (hasAny(types, BackMatterTypes)) return 'back';
  if (hasAny(types, FrontMatterTypes)) return 'front';

  return matterFromTitle(title);
};
