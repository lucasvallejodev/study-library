import type { Annotation, HighlightColor } from '@study/core';

export const HighlightColors: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

export function quoteOf(annotation: Annotation): string | undefined {
  const quote = annotation.selectors.find(selector => selector.type === 'TextQuoteSelector');

  return quote?.type === 'TextQuoteSelector' ? quote.exact : undefined;
}

export function annotationAnchorHref(annotation: Annotation): string | undefined {
  if (annotation.documentId && annotation.chapterId) {
    return annotationPath(annotation.documentId, annotation.chapterId, annotation.id);
  }

  return undefined;
}

export function annotationPath(docId: string, chapterId: string, annotationId: string): string {
  return `/read/${docId}/${chapterId}#${annotationId}`;
}

export function tagHref(tag: string): string {
  return `/notebook?tag=${encodeURIComponent(tag)}`;
}

export function studyPrompt(docId: string, chapterId: string, annotationId: string): string {
  return `/study ${docId} ${chapterId} --focus ${annotationId}`;
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text).catch(ignoreFailure);
}

export function ignoreFailure(): undefined {
  return undefined;
}
