import type { Annotation } from './api-types';
import { API_URL } from './client';
import { Patterns } from './patterns';

const FREE_NOTES_HEADING = '(free notes)';
const QUOTE_SELECTOR = 'TextQuoteSelector';

const groupHeading = (annotation: Annotation): string => {
  const documentPart = annotation.documentId ?? FREE_NOTES_HEADING;

  return annotation.chapterId ? `${documentPart} / ${annotation.chapterId}` : documentPart;
};

const readerLink = (annotation: Annotation): string => {
  const { chapterId, documentId, id } = annotation;

  return documentId && chapterId ? `${API_URL}/read/${documentId}/${chapterId}#${id}` : id;
};

const hashtag = (tag: string): string => `#${tag}`;

const headline = (annotation: Annotation): string => {
  const colorSuffix = annotation.color ? ` (${annotation.color})` : '';
  const tagList = annotation.tags.map(hashtag).join(' ');
  const tagSuffix = annotation.tags.length ? ` ${tagList}` : '';
  const orphanSuffix = annotation.orphaned ? ' — orphaned' : '';

  return `- **${annotation.type}**${colorSuffix}${tagSuffix} — ${readerLink(annotation)}${orphanSuffix}`;
};

const quotedPassage = (annotation: Annotation): string | undefined =>
  annotation.selectors.find(selector => selector.type === QUOTE_SELECTOR)?.exact;

const annotationLines = (annotation: Annotation): string[] => {
  const lines = [headline(annotation)];
  const quote = quotedPassage(annotation);

  if (quote) lines.push(`  > ${quote.replace(Patterns.lineBreakRun, ' ')}`);
  if (annotation.body) lines.push(`  ${annotation.body.replace(Patterns.lineBreak, '\n  ')}`);

  return lines;
};

export const annotationsToMarkdown = (annotations: Annotation[]): string => {
  const lines: string[] = [];
  let currentHeading = '';

  for (const annotation of [...annotations].reverse()) {
    const heading = groupHeading(annotation);

    if (heading !== currentHeading) {
      lines.push('', `## ${heading}`, '');
      currentHeading = heading;
    }

    lines.push(...annotationLines(annotation));
  }

  return lines.join('\n').trim();
};
