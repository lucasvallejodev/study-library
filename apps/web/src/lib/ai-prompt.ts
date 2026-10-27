import 'server-only';

import { getQuote, resolveSelectors } from '@study/anchoring';
import { type ChapterEntry, chapterRoute, type LibraryDocument } from '@study/core';

import type { AnnotationRow } from './annotations';
import { chapterWithAnnotations } from './chapter-export';
import { Patterns } from './patterns';

/** Input of {@link chapterAiPrompt} and {@link passageAiPrompt}. */
export type AiPromptOptions = {
  annotations: AnnotationRow[];
  chapter: ChapterEntry;
  doc: LibraryDocument;
  markdown: string;
  origin: string;
};

type TextSpan = {
  end: number;
  start: number;
};

const PARAGRAPH_BREAK = '\n\n';
const CONTEXT_PARAGRAPHS_AROUND_PASSAGE = 3;

const WhatToAskFor = [
  '## What I would like',
  '',
  'Ask me one or two short questions first if my goal is unclear, then help with any of these:',
  '',
  '- Answer my questions about it and suggest follow-up questions worth asking.',
  '- Point me to good resources to go deeper (videos, articles, official docs), each with why it is worth it and how long it takes.',
  '- Summarize it in plain words.',
  '- Give concrete examples, an analogy or a diagram (Mermaid is fine) to make it click.',
  '',
  'Images are linked in the text: open them, they often hold diagrams that explain more. If you cannot open links, tell me and I will attach them.',
].join('\n');

const absoluteAssetLinks = (markdown: string, origin: string, docId: string): string =>
  markdown.replace(Patterns.relativeAssetReference, `${origin}/api/assets/${docId}/assets/`);

const byLine = (doc: LibraryDocument): string =>
  doc.authors.length ? ` by ${doc.authors.join(', ')}` : '';

const intro = ({ chapter, doc }: AiPromptOptions, subject: string): string =>
  `I am studying “${chapter.title}” from “${doc.title}”${byLine(doc)}. Help me understand ${subject}.`;

const widenToParagraphs = (markdown: string, span: TextSpan, count: number): TextSpan => {
  let { end, start } = span;

  for (let step = 0; step < count; step++) {
    start = Math.max(0, markdown.lastIndexOf(PARAGRAPH_BREAK, start - 1));
    const next = markdown.indexOf(PARAGRAPH_BREAK, end + 1);

    end = next === -1 ? markdown.length : next;
  }

  return { end, start };
};

const passageContext = (markdown: string, row: AnnotationRow): string | undefined => {
  const quote = getQuote(row.selectors);
  const anchor = quote ? resolveSelectors(markdown, [{ ...quote }]) : undefined;

  if (!anchor) return undefined;
  const span = widenToParagraphs(markdown, anchor, CONTEXT_PARAGRAPHS_AROUND_PASSAGE);

  return markdown.slice(span.start, span.end).trim();
};

const blockquote = (text: string): string => `> ${text.trim().split('\n').join('\n> ')}`;

const section = (heading: string, body: string | null | undefined): string[] =>
  body ? [`## ${heading}`, '', body, ''] : [];

/**
 * Builds a self-contained prompt about one highlight or note, to paste into any AI assistant.
 *
 * @remarks
 * Holds the passage, the reader's note and tags, the paragraphs around the passage with images
 * linked by absolute URL, the deep link and a short list of things to ask for.
 *
 * @param opts - The chapter, its document, Markdown and annotations, and the origin for links.
 * @param row - The highlight or note the prompt is about.
 * @returns The prompt as Markdown.
 */
export const passageAiPrompt = (opts: AiPromptOptions, row: AnnotationRow): string => {
  const { chapter, doc, markdown, origin } = opts;
  const context = passageContext(markdown, row);
  const tags = row.tags.length ? row.tags.map(tag => `#${tag}`).join(' ') : undefined;

  return [
    intro(opts, row.quote ? 'this passage' : 'this note'),
    '',
    ...section('The passage', row.quote && blockquote(row.quote)),
    ...section('My note', row.body),
    ...section('My tags', tags),
    ...section('Around the passage', context && absoluteAssetLinks(context, origin, doc.id)),
    ...section('Link', `${origin}${chapterRoute(doc.id, chapter.id, row.id)}`),
    WhatToAskFor,
    '',
  ].join('\n');
};

/**
 * Builds a self-contained prompt about a whole chapter, to paste into any AI assistant.
 *
 * @remarks
 * Holds the chapter's Markdown with the reader's highlights inlined as `==text==[^id]` (see
 * {@link chapterWithAnnotations}), images linked by absolute URL, and a short list of things to
 * ask for.
 *
 * @param opts - The chapter, its document, Markdown and annotations, and the origin for links.
 * @returns The prompt as Markdown.
 */
export const chapterAiPrompt = (opts: AiPromptOptions): string => {
  const { annotations, chapter, doc, markdown, origin } = opts;

  const annotated = chapterWithAnnotations({
    annotations,
    chapterId: chapter.id,
    docId: doc.id,
    markdown,
    origin,
    title: chapter.title,
  });

  return [
    intro(opts, 'this chapter'),
    'My highlights are marked ==like this==, with my notes in the footnotes.',
    '',
    WhatToAskFor,
    '',
    '---',
    '',
    absoluteAssetLinks(annotated, origin, doc.id),
  ].join('\n');
};
