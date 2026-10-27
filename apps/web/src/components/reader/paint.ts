import type { Annotation } from '@study/core';

export const HIGHLIGHT_NAMES = [
  'hl-yellow',
  'hl-green',
  'hl-blue',
  'hl-pink',
  'hl-question',
  'hl-note',
  'hl-active',
] as const;

export function supportsHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function nameFor(a: Annotation): (typeof HIGHLIGHT_NAMES)[number] {
  if (a.type === 'ai_question') return 'hl-question';

  return `hl-${a.color ?? 'yellow'}` as (typeof HIGHLIGHT_NAMES)[number];
}

/** Paint anchored annotations without touching the DOM (CSS Custom Highlight API). */
export function paintHighlights(anchored: { a: Annotation; range: Range }[], activeId?: string) {
  if (!supportsHighlights()) return paintWithMarks(anchored);
  const groups = new Map<string, Range[]>(HIGHLIGHT_NAMES.map(n => [n, []]));

  for (const { a, range } of anchored) {
    // Uncolored notes (e.g. Claude's notes on your highlight) only underline the passage.
    if (!(a.type === 'note' && !a.color)) groups.get(nameFor(a))!.push(range);
    if (a.body) groups.get('hl-note')!.push(range);
    if (a.id === activeId) groups.get('hl-active')!.push(range);
  }

  for (const [name, ranges] of groups) CSS.highlights.set(name, new Highlight(...ranges));
}

export function clearHighlights() {
  if (supportsHighlights()) for (const n of HIGHLIGHT_NAMES) CSS.highlights.delete(n);
}

/** Fallback for browsers without the Highlight API: wrap text nodes in <mark>. */
function paintWithMarks(anchored: { a: Annotation; range: Range }[]) {
  const root = anchored[0]?.range.commonAncestorContainer.ownerDocument;

  root
    ?.querySelectorAll('mark[data-annotation]')
    .forEach(m => m.replaceWith(...Array.from(m.childNodes)));

  for (const { a, range } of anchored) {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    let n: Node | null = walker.currentNode;

    while (n) {
      if (n.nodeType === Node.TEXT_NODE && range.intersectsNode(n)) nodes.push(n as Text);
      n = walker.nextNode();
    }

    for (let text of nodes) {
      if (text === range.startContainer && range.startOffset > 0) {
        text = text.splitText(range.startOffset);
      }

      if (text === range.endContainer || (nodes.at(-1) === text && range.endContainer === text)) {
        text.splitText(range.endOffset);
      }

      const mark = document.createElement('mark');

      mark.dataset.annotation = a.id;
      mark.dataset.color = a.color ?? 'yellow';
      text.replaceWith(mark);
      mark.appendChild(text);
    }
  }
}
