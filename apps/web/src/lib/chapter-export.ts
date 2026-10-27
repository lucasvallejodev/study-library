import 'server-only';

import { type Anchor, getQuote, resolveSelectors } from '@study/anchoring';
import { chapterRoute } from '@study/core';

import type { AnnotationRow } from './annotations';
import { flattenLineBreaks, indentContinuationLines, indentLines } from './patterns';

/** Input of {@link chapterWithAnnotations}. */
export type ChapterExportOptions = {
  annotations: AnnotationRow[];
  chapterId: string;
  docId: string;
  markdown: string;
  origin: string;
  title: string;
};

type PlacedAnnotation = {
  anchor: Anchor;
  row: AnnotationRow;
};

type InlinedMarkdown = {
  inlined: Set<string>;
  markdown: string;
};

type LinkTo = (annotationId: string) => string;

const PARAGRAPH_BREAK = '\n\n';
const LIST_ITEM_INDENT = '  ';

const anchorInMarkdown = (markdown: string, row: AnnotationRow): PlacedAnnotation | undefined => {
  const quote = getQuote(row.selectors);

  if (!quote) return undefined;

  const anchor = resolveSelectors(markdown, [{ ...quote }]);

  return anchor ? { anchor, row } : undefined;
};

const isConfidentPlacement = (
  placement: PlacedAnnotation | undefined
): placement is PlacedAnnotation => !!placement && placement.anchor.quality !== 'fuzzy';

const lastPassageFirst = (left: PlacedAnnotation, right: PlacedAnnotation): number =>
  right.anchor.start - left.anchor.start;

const placeAnnotationsByQuote = (markdown: string, rows: AnnotationRow[]): PlacedAnnotation[] =>
  rows
    .filter(row => row.selectors.length)
    .map(row => anchorInMarkdown(markdown, row))
    .filter(isConfidentPlacement)
    .sort(lastPassageFirst);

const wrapAsHighlight = (markdown: string, { anchor, row }: PlacedAnnotation): string => {
  const before = markdown.slice(0, anchor.start);
  const passage = markdown.slice(anchor.start, anchor.end);
  const after = markdown.slice(anchor.end);

  return `${before}==${passage}==[^${row.id}]${after}`;
};

const inlineHighlightsFromTheEnd = (markdown: string, rows: AnnotationRow[]): InlinedMarkdown => {
  const inlined = new Set<string>();
  let result = markdown;
  let lastStart = Infinity;

  for (const placement of placeAnnotationsByQuote(markdown, rows)) {
    const { anchor, row } = placement;
    const overlapsLaterHighlight = anchor.end > lastStart;
    const spansParagraphs = result.slice(anchor.start, anchor.end).includes(PARAGRAPH_BREAK);

    if (overlapsLaterHighlight || spansParagraphs) continue;

    result = wrapAsHighlight(result, placement);
    lastStart = anchor.start;
    inlined.add(row.id);
  }

  return { inlined, markdown: result };
};

const describeAnnotation = (row: AnnotationRow, linkTo: LinkTo): string => {
  const color = row.color ? ` (${row.color})` : '';
  const parts = [`${row.type}${color}`, linkTo(row.id)];

  if (row.tags.length) parts.push(`tags: ${row.tags.join(', ')}`);

  return parts.join(' · ');
};

const footnoteLine = (row: AnnotationRow, linkTo: LinkTo): string => {
  const body = row.body ? ` — ${flattenLineBreaks(row.body)}` : '';

  return `[^${row.id}]: ${describeAnnotation(row, linkTo)}${body}`;
};

const quoteBlock = (quote: string | null): string =>
  quote ? indentLines(`> ${flattenLineBreaks(quote)}${PARAGRAPH_BREAK}`, LIST_ITEM_INDENT) : '';

const bodyBlock = (body: string | null): string =>
  body ? `${LIST_ITEM_INDENT}${indentContinuationLines(body, LIST_ITEM_INDENT)}\n` : '';

const listedAnnotation = (row: AnnotationRow, linkTo: LinkTo): string => {
  const orphaned = row.orphaned ? ' (orphaned)' : '';

  return `- **${describeAnnotation(row, linkTo)}**${orphaned}${PARAGRAPH_BREAK}${quoteBlock(row.quote)}${bodyBlock(row.body)}`;
};

const notInlinedSection = (rows: AnnotationRow[], linkTo: LinkTo): string => {
  if (!rows.length) return '';

  const section = [
    '## Your annotations not shown inline',
    '',
    ...rows.map(row => listedAnnotation(row, linkTo)),
  ];

  return `${PARAGRAPH_BREAK}---${PARAGRAPH_BREAK}${section.join('\n')}`;
};

const headerComment = (options: ChapterExportOptions): string => {
  const { annotations, chapterId, docId, origin, title } = options;
  const chapterLink = `${origin}${chapterRoute(docId, chapterId)}`;

  return `<!-- ${docId}/${chapterId}: ${title} · ${annotations.length} annotations · ${chapterLink} -->${PARAGRAPH_BREAK}`;
};

/**
 * Builds chapter Markdown for AI tools with the reader's annotations woven in.
 *
 * @remarks
 * Highlights whose quote is found in the Markdown source are inlined as `==text==[^id]`, with a
 * footnote holding the note and deep link. Quotes are matched without positions because the
 * source differs from the rendered text (emphasis markers); fuzzy matches, overlapping
 * highlights and passages spanning paragraphs are not inlined but listed at the end, together
 * with chapter notes and orphans.
 *
 * @param opts - The chapter's Markdown, ids, title, its annotations and the origin for links.
 * @returns The Markdown document.
 */
export const chapterWithAnnotations = (opts: ChapterExportOptions): string => {
  const { annotations, chapterId, docId, origin } = opts;
  const linkTo: LinkTo = annotationId => `${origin}${chapterRoute(docId, chapterId, annotationId)}`;
  const { inlined, markdown } = inlineHighlightsFromTheEnd(opts.markdown, annotations);

  const footnotes = annotations
    .filter(row => inlined.has(row.id))
    .map(row => footnoteLine(row, linkTo));

  const others = annotations.filter(row => !inlined.has(row.id));

  return `${headerComment(opts)}${markdown.trim()}${PARAGRAPH_BREAK}${footnotes.join('\n')}${notInlinedSection(others, linkTo)}\n`;
};
