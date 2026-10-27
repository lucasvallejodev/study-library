import type { EpubBook } from './epub-book';
import {
  footnoteHtml,
  footnotePlaceholder,
  isBacklink,
  isNoteReference,
  restoreFootnoteReferences,
} from './epub-footnotes';
import { localiseChunkImages } from './epub-images';
import type { EpubChapterDraft } from './epub-slicing';
import { type EpubHref, resolveHref } from './epub-xml';
import { cleanHtml, newHtmlDocument, serialize } from './html';
import { hasUrlScheme, Patterns } from './patterns';
import { mapLimit, pandocHtmlToMarkdown } from './tools';
import { appendFootnotes, type AssetStore, type FinishedChapter, tidyMarkdown } from './writer';

const CHAPTER_CONVERSION_CONCURRENCY = 6;
const SOURCE_FILE_ATTRIBUTE = 'data-file';

/**
 * What every chapter conversion of one book shares; `linkTarget` maps an archive path (and
 * optional `#fragment`) to the id of the chapter that contains it, to rewrite internal links.
 */
export type ConvertContext = {
  assets: AssetStore;
  book: EpubBook;
  docId: string;
  linkTarget: (file: string, fragment?: string) => string | undefined;
};

type ChapterConversion = {
  chapterId: string;
  consumedNoteIds: Set<string>;
  context: ConvertContext;
  notes: string[];
};

type NoteTarget = Required<EpubHref>;

const assembleChapterRoot = (draft: EpubChapterDraft): Element => {
  const doc = newHtmlDocument();
  const root = doc.createElement('div');

  for (const part of draft.parts) {
    const chunk = doc.createElement('div');

    chunk.setAttribute(SOURCE_FILE_ATTRIBUTE, part.getAttribute(SOURCE_FILE_ATTRIBUTE) ?? '');
    chunk.append(...Array.from(part.childNodes).map(node => doc.importNode(node, true)));
    root.appendChild(chunk);
  }

  return root;
};

const inlineFootnote = async (
  link: Element,
  file: string,
  target: NoteTarget,
  conversion: ChapterConversion
): Promise<boolean> => {
  const noteHtml = await footnoteHtml(conversion.context.book, target.file, target.fragment);

  if (noteHtml === undefined) return false;
  conversion.notes.push(noteHtml);
  if (target.file === file) conversion.consumedNoteIds.add(target.fragment);
  link.replaceWith(link.ownerDocument.createTextNode(footnotePlaceholder(conversion.notes.length)));

  return true;
};

const pointLinkAtChapter = (
  link: Element,
  href: string,
  target: EpubHref,
  conversion: ChapterConversion
): void => {
  const { context } = conversion;
  const chapter = context.linkTarget(target.file, target.fragment);

  if (chapter) {
    link.setAttribute('href', `/read/${context.docId}/${chapter}`);

    return;
  }

  context.book.warnings.push({
    chapterId: conversion.chapterId,
    code: 'broken-link',
    message: `Link to ${href} has no matching chapter`,
  });
  link.replaceWith(...Array.from(link.childNodes));
};

const rewriteLink = async (
  link: Element,
  file: string,
  conversion: ChapterConversion
): Promise<void> => {
  const href = link.getAttribute('href');

  if (href === null || hasUrlScheme(href)) return;
  const target = resolveHref(href, file);
  const { fragment } = target;

  if (isNoteReference(link) && fragment) {
    if (await inlineFootnote(link, file, { file: target.file, fragment }, conversion)) return;
  }

  pointLinkAtChapter(link, href, target, conversion);
};

const escapeAttributeValue = (value: string): string =>
  value.replace(Patterns.quoteOrBackslash, '\\$&');

const removeInlinedNotes = (chunk: Element, noteIds: Set<string>): void => {
  for (const id of noteIds) chunk.querySelector(`[id="${escapeAttributeValue(id)}"]`)?.remove();
};

const convertChunk = async (chunk: Element, conversion: ChapterConversion): Promise<void> => {
  const file = chunk.getAttribute(SOURCE_FILE_ATTRIBUTE) ?? '';

  for (const link of Array.from(chunk.querySelectorAll('a[href]'))) {
    await rewriteLink(link, file, conversion);
  }

  removeInlinedNotes(chunk, conversion.consumedNoteIds);
  await localiseChunkImages(chunk, file, conversion.context, conversion.chapterId);
};

const removeEndnoteBacklinks = (root: Element): void => {
  for (const link of Array.from(root.querySelectorAll('a'))) {
    if (isBacklink(link)) link.remove();
  }
};

const noteToMarkdown = async (noteHtml: string): Promise<string> =>
  tidyMarkdown(await pandocHtmlToMarkdown(noteHtml));

const renderMarkdown = async (root: Element, notes: string[]): Promise<string> => {
  cleanHtml(root);
  const converted = await pandocHtmlToMarkdown(serialize(root));
  const markdown = tidyMarkdown(restoreFootnoteReferences(converted));

  if (!notes.length) return markdown;

  return appendFootnotes(markdown, await Promise.all(notes.map(noteToMarkdown)));
};

/**
 * Converts one chapter draft to Markdown.
 *
 * @remarks
 * Each chunk keeps its source file, so relative hrefs resolve correctly. Note references become
 * `[^n]` footnotes with the note text pulled from its target (and removed from the chapter when
 * it lives in the same file), internal links point at `/read/<doc>/<chapter>`, images are
 * copied into the asset store, endnote back-links are dropped, then the cleaned HTML goes
 * through Pandoc.
 *
 * @param draft - The chapter's slice and copied nodes.
 * @param chapterId - Id the chapter will have, for warnings.
 * @param ctx - What every chapter of the book shares.
 * @returns The chapter's Markdown with footnote definitions appended.
 */
export const convertChapter = async (
  draft: EpubChapterDraft,
  chapterId: string,
  ctx: ConvertContext
): Promise<string> => {
  const root = assembleChapterRoot(draft);

  const conversion: ChapterConversion = {
    chapterId,
    consumedNoteIds: new Set(),
    context: ctx,
    notes: [],
  };

  for (const chunk of Array.from(root.querySelectorAll(`div[${SOURCE_FILE_ATTRIBUTE}]`))) {
    await convertChunk(chunk, conversion);
  }

  removeEndnoteBacklinks(root);

  return renderMarkdown(root, conversion.notes);
};

const chapterLinkTargets = (
  book: EpubBook,
  drafts: EpubChapterDraft[],
  ids: string[]
): ConvertContext['linkTarget'] => {
  const anchorToChapter = new Map<string, string>();
  const fileToChapter = new Map<string, string>();

  for (const [index, draft] of drafts.entries()) {
    if (draft.start.fragment) {
      anchorToChapter.set(`${book.spine[draft.start.spine]}#${draft.start.fragment}`, ids[index]);
    }
  }

  for (const [spine, file] of book.spine.entries()) {
    const owner = ids[drafts.findLastIndex(draft => draft.start.spine <= spine)];

    if (owner) fileToChapter.set(file, owner);
  }

  return (file, fragment) => {
    const anchored = fragment ? anchorToChapter.get(`${file}#${fragment}`) : undefined;

    return anchored ?? fileToChapter.get(file);
  };
};

/** The chapters of one book to convert, with their ids and destination. */
export type EpubConversion = {
  assets: AssetStore;
  book: EpubBook;
  docId: string;
  drafts: EpubChapterDraft[];
  ids: string[];
};

/**
 * Converts every chapter of a book to Markdown, six at a time.
 *
 * @param conversion - The book, its chapter drafts, their ids (same order), the document id and
 * the asset store receiving the images.
 * @returns The finished chapters in reading order.
 */
export const convertEpub = async ({
  assets,
  book,
  docId,
  drafts,
  ids,
}: EpubConversion): Promise<FinishedChapter[]> => {
  const ctx: ConvertContext = {
    assets,
    book,
    docId,
    linkTarget: chapterLinkTargets(book, drafts, ids),
  };

  const markdowns = await mapLimit(drafts, CHAPTER_CONVERSION_CONCURRENCY, (draft, index) =>
    convertChapter(draft, ids[index], ctx)
  );

  return drafts.map((draft, index) => ({
    depth: draft.depth,
    id: ids[index],
    markdown: markdowns[index],
    matter: draft.matter,
    title: draft.title,
  }));
};
