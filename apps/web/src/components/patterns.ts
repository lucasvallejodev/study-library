export const Patterns = {
  ampersand: /&/g,
  escapedMarkClose: /&lt;\/mark>/g,
  escapedMarkOpen: /&lt;mark>/g,
  lessThan: /</g,
  nonIdCharacter: /[^\w-]/g,
  whitespaceCharacter: /\s/,
};

export function isWhitespace(character: string | undefined): boolean {
  return Patterns.whitespaceCharacter.test(String(character));
}

export function escapeHtmlKeepingMarks(snippet: string): string {
  return snippet
    .replace(Patterns.ampersand, '&amp;')
    .replace(Patterns.lessThan, '&lt;')
    .replace(Patterns.escapedMarkOpen, '<mark>')
    .replace(Patterns.escapedMarkClose, '</mark>');
}
