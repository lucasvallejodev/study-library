import 'server-only';

import { getQuote, resolveSelectors } from '@study/anchoring';
import { chapterRoute } from '@study/core';

import type { AnnotationRow } from './data';

/**
 * Chapter Markdown for AI tools: highlights inlined as ==text== with a footnote holding the
 * note and deep link, plus a list of every annotation at the end (chapter notes, orphans).
 *
 * @param opts
 */
export const chapterWithAnnotations = (opts: {
  annotations: AnnotationRow[];
  chapterId: string;
  docId: string;
  markdown: string;
  origin: string;
  title: string;
}): string => {
  const { chapterId, docId, origin } = opts;
  let md = opts.markdown;
  const link = (id: string) => `${origin}${chapterRoute(docId, chapterId, id)}`;
  const inlined = new Set<string>();

  // Insert from the end of the text so earlier offsets stay valid.
  const placed = opts.annotations
    .filter(a => a.selectors.length)
    .map(a => {
      const quote = getQuote(a.selectors);

      if (!quote) return undefined;
      // Markdown source differs from rendered text (emphasis markers), so match the bare quote.
      const anchor = resolveSelectors(md, [{ ...quote }]);

      return anchor ? { a, anchor } : undefined;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.anchor.quality !== 'fuzzy')
    .sort((x, y) => y.anchor.start - x.anchor.start);

  let lastStart = Infinity;

  for (const { a, anchor } of placed) {
    if (anchor.end > lastStart || md.slice(anchor.start, anchor.end).includes('\n\n')) continue;
    md = `${md.slice(0, anchor.start)}==${md.slice(anchor.start, anchor.end)}==[^${a.id}]${md.slice(anchor.end)}`;
    lastStart = anchor.start;
    inlined.add(a.id);
  }

  const lines: string[] = [];

  const describe = (a: AnnotationRow) => {
    const parts = [`${a.type}${a.color ? ` (${a.color})` : ''}`, link(a.id)];

    if (a.tags.length) parts.push(`tags: ${a.tags.join(', ')}`);

    return parts.join(' · ');
  };

  for (const a of opts.annotations.filter(x => inlined.has(x.id))) {
    lines.push(`[^${a.id}]: ${describe(a)}${a.body ? ` — ${a.body.replace(/\n+/g, ' ')}` : ''}`);
  }

  const others = opts.annotations.filter(a => !inlined.has(a.id));
  const section: string[] = [];

  if (others.length) {
    section.push('## Your annotations not shown inline', '');

    for (const a of others) {
      const quote = a.quote ? `> ${a.quote.replace(/\n+/g, ' ')}\n\n` : '';

      section.push(
        `- **${describe(a)}**${a.orphaned ? ' (orphaned)' : ''}\n\n${quote ? quote.replace(/^/gm, '  ') : ''}${a.body ? `  ${a.body.replace(/\n/g, '\n  ')}\n` : ''}`
      );
    }
  }

  const header = `<!-- ${docId}/${chapterId}: ${opts.title} · ${opts.annotations.length} annotations · ${origin}${chapterRoute(docId, chapterId)} -->\n\n`;

  return `${header}${md.trim()}\n\n${lines.join('\n')}${section.length ? `\n\n---\n\n${section.join('\n')}` : ''}\n`;
};
