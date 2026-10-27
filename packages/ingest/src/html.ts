import { JSDOM } from 'jsdom';

// One window for every document, so nodes can move between XHTML and HTML documents.
const window = new JSDOM('').window;

/**
 * Parse XHTML strictly when possible (keeps namespaces), falling back to the HTML parser.
 *
 * @param source
 */
export const parseXhtml = (source: string): Document => {
  const parser = new window.DOMParser();

  try {
    const doc = parser.parseFromString(source, 'application/xhtml+xml');

    if (!doc.getElementsByTagName('parsererror').length) return doc;
  } catch {
    // fall through to the forgiving HTML parser
  }

  return parser.parseFromString(source, 'text/html');
};

/**
 *
 */
export const newHtmlDocument = (): Document =>
  window.document.implementation.createHTMLDocument('');

/**
 *
 * @param el
 */
export const epubTypes = (el: Element | null | undefined): string[] => {
  if (!el) return [];

  const value =
    el.getAttribute('epub:type') ?? el.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? '';

  const role = el.getAttribute('role') ?? '';

  return `${value} ${role}`.split(/\s+/).filter(Boolean);
};

const KEEP_ATTRIBUTES = new Set([
  'href',
  'src',
  'alt',
  'title',
  'colspan',
  'rowspan',
  'start',
  'type',
  'data-footnote',
]);

const UNWRAP = new Set([
  'span',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'body',
  'font',
  'center',
  'small',
  'big',
]);

const DROP = new Set([
  'script',
  'style',
  'link',
  'meta',
  'noscript',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
]);

/**
 * Normalise a chapter's HTML before Pandoc: drop presentational markup, unwrap layout
 * containers, merge <hgroup> into one heading. Keeps semantic tags (p, em, lists, tables...).
 *
 * @param root
 */
export const cleanHtml = (root: Element): void => {
  const doc = root.ownerDocument;

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const tag = el.localName.toLowerCase();

    if (DROP.has(tag)) el.remove();
  }

  for (const hgroup of Array.from(root.querySelectorAll('hgroup'))) {
    const heading = hgroup.querySelector('h1,h2,h3,h4,h5,h6');
    const level = heading ? heading.localName : 'h2';

    const parts = Array.from(hgroup.children)
      .map(c => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const h = doc.createElement(level);

    h.textContent = parts.join(': ');
    hgroup.replaceWith(h);
  }

  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (!KEEP_ATTRIBUTES.has(attr.localName) || attr.name.includes(':')) {
        if (attr.localName === 'href' && attr.name === 'xlink:href') continue;
        el.removeAttribute(attr.name);
      }
    }
  }

  for (const el of Array.from(root.querySelectorAll('*')).reverse()) {
    if (UNWRAP.has(el.localName.toLowerCase())) el.replaceWith(...Array.from(el.childNodes));
  }

  for (const p of Array.from(root.querySelectorAll('p'))) {
    if (!p.textContent?.trim() && !p.querySelector('img,svg')) p.remove();
  }
};

/**
 *
 * @param root
 */
export const serialize = (root: Element): string => root.innerHTML;
