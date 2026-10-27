import type { Annotation } from '@study/core';

export const HighlightNames = [
  'hl-yellow',
  'hl-green',
  'hl-blue',
  'hl-pink',
  'hl-question',
  'hl-note',
  'hl-active',
] as const;

type HighlightName = (typeof HighlightNames)[number];

export type AnchoredAnnotation = {
  annotation: Annotation;
  range: Range;
};

export function supportsHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function colorHighlightOf(annotation: Annotation): HighlightName {
  if (annotation.type === 'ai_question') return 'hl-question';

  return `hl-${annotation.color ?? 'yellow'}` as HighlightName;
}

function isUnderlineOnlyNote(annotation: Annotation): boolean {
  return annotation.type === 'note' && !annotation.color;
}

function highlightsOf(annotation: Annotation, activeId?: string): HighlightName[] {
  const names: HighlightName[] = [];

  if (!isUnderlineOnlyNote(annotation)) names.push(colorHighlightOf(annotation));
  if (annotation.body) names.push('hl-note');
  if (annotation.id === activeId) names.push('hl-active');

  return names;
}

export function paintHighlights(anchored: AnchoredAnnotation[], activeId?: string) {
  if (!supportsHighlights()) return paintWithMarks(anchored);
  const groups = new Map<HighlightName, Range[]>(HighlightNames.map(name => [name, []]));

  for (const { annotation, range } of anchored) {
    for (const name of highlightsOf(annotation, activeId)) groups.get(name)?.push(range);
  }

  for (const [name, ranges] of groups) CSS.highlights.set(name, new Highlight(...ranges));
}

export function clearHighlights() {
  if (supportsHighlights()) for (const name of HighlightNames) CSS.highlights.delete(name);
}

function unwrapMarks(root: Document | undefined) {
  root
    ?.querySelectorAll('mark[data-annotation]')
    .forEach(mark => mark.replaceWith(...Array.from(mark.childNodes)));
}

function textNodesIn(range: Range): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.currentNode;

  while (node) {
    if (node.nodeType === Node.TEXT_NODE && range.intersectsNode(node)) nodes.push(node as Text);
    node = walker.nextNode();
  }

  return nodes;
}

function isRangeEnd(text: Text, range: Range, nodes: Text[]): boolean {
  return text === range.endContainer || (nodes.at(-1) === text && range.endContainer === text);
}

function clipToRange(original: Text, range: Range, nodes: Text[]): Text {
  let text = original;

  if (text === range.startContainer && range.startOffset > 0) {
    text = text.splitText(range.startOffset);
  }

  if (isRangeEnd(text, range, nodes)) text.splitText(range.endOffset);

  return text;
}

function wrapInMark(text: Text, annotation: Annotation) {
  const mark = document.createElement('mark');

  mark.dataset.annotation = annotation.id;
  mark.dataset.color = annotation.color ?? 'yellow';
  text.replaceWith(mark);
  mark.appendChild(text);
}

function paintWithMarks(anchored: AnchoredAnnotation[]) {
  unwrapMarks(anchored[0]?.range.commonAncestorContainer.ownerDocument ?? undefined);

  for (const { annotation, range } of anchored) {
    const nodes = textNodesIn(range);

    for (const text of nodes) wrapInMark(clipToRange(text, range, nodes), annotation);
  }
}
