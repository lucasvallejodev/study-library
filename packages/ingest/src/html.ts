import { JSDOM } from 'jsdom';

import { Patterns } from './patterns';
import { collapseWhitespace } from './text';

// eslint-disable-next-line sonarjs/no-clear-text-protocols -- XML namespace identifier, never fetched
const OPS_NAMESPACE = 'http://www.idpf.org/2007/ops';

const DEFAULT_HEADING_LEVEL = 'h2';

const windowSharedByEveryDocument = new JSDOM('').window;

const KeptAttributes = new Set([
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

const LayoutContainers = new Set([
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

const NonContentElements = new Set([
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

const parseStrictXhtml = (parser: DOMParser, source: string): Document | undefined => {
  try {
    const document = parser.parseFromString(source, 'application/xhtml+xml');

    return document.getElementsByTagName('parsererror').length ? undefined : document;
  } catch {
    return undefined;
  }
};

/**
 * Parses XHTML strictly when possible (keeps namespaces), falling back to the HTML parser.
 *
 * @remarks
 * Every document shares one jsdom window, so nodes can move between XHTML and HTML documents.
 *
 * @param source - Markup of one EPUB content file.
 * @returns The parsed document.
 */
export const parseXhtml = (source: string): Document => {
  const parser = new windowSharedByEveryDocument.DOMParser();

  return parseStrictXhtml(parser, source) ?? parser.parseFromString(source, 'text/html');
};

/**
 * Creates an empty HTML document in the window every parsed document shares.
 *
 * @returns A blank HTML document to build chapter markup in.
 */
export const newHtmlDocument = (): Document =>
  windowSharedByEveryDocument.document.implementation.createHTMLDocument('');

/**
 * Lists the semantic types of an element: its `epub:type` values plus its ARIA `role`.
 *
 * @param element - Element to inspect; missing elements have no types.
 * @returns The individual type tokens (`chapter`, `noteref`, `doc-endnotes`…).
 */
export const epubTypes = (element: Element | null | undefined): string[] => {
  if (!element) return [];

  const value =
    element.getAttribute('epub:type') ?? element.getAttributeNS(OPS_NAMESPACE, 'type') ?? '';

  const role = element.getAttribute('role') ?? '';

  return `${value} ${role}`.split(Patterns.whitespaceRun).filter(Boolean);
};

const allElements = (root: Element): Element[] => Array.from(root.querySelectorAll('*'));

const dropNonContentElements = (root: Element): void => {
  for (const element of allElements(root)) {
    if (NonContentElements.has(element.localName.toLowerCase())) element.remove();
  }
};

const mergeHeadingGroups = (root: Element): void => {
  for (const headingGroup of Array.from(root.querySelectorAll('hgroup'))) {
    const heading = headingGroup.querySelector('h1,h2,h3,h4,h5,h6');
    const level = heading ? heading.localName : DEFAULT_HEADING_LEVEL;

    const parts = Array.from(headingGroup.children)
      .map(child => collapseWhitespace(child.textContent ?? ''))
      .filter(Boolean);

    const merged = root.ownerDocument.createElement(level);

    merged.textContent = parts.join(': ');
    headingGroup.replaceWith(merged);
  }
};

const isXlinkHref = (attribute: Attr): boolean =>
  attribute.localName === 'href' && attribute.name === 'xlink:href';

const isPresentationalAttribute = (attribute: Attr): boolean => {
  if (isXlinkHref(attribute)) return false;

  return !KeptAttributes.has(attribute.localName) || attribute.name.includes(':');
};

const stripPresentationalAttributes = (root: Element): void => {
  for (const element of allElements(root)) {
    for (const attribute of Array.from(element.attributes)) {
      if (isPresentationalAttribute(attribute)) element.removeAttribute(attribute.name);
    }
  }
};

const unwrapLayoutContainers = (root: Element): void => {
  for (const element of allElements(root).reverse()) {
    if (LayoutContainers.has(element.localName.toLowerCase())) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  }
};

const removeEmptyParagraphs = (root: Element): void => {
  for (const paragraph of Array.from(root.querySelectorAll('p'))) {
    if (!paragraph.textContent?.trim() && !paragraph.querySelector('img,svg')) paragraph.remove();
  }
};

/**
 * Normalises a chapter's HTML before Pandoc, keeping semantic tags (p, em, lists, tables…).
 *
 * @remarks
 * Drops scripts, styles and form controls, merges each `<hgroup>` into one heading, strips
 * presentational attributes, unwraps layout containers and removes empty paragraphs.
 *
 * @param root - Element whose content is cleaned in place.
 */
export const cleanHtml = (root: Element): void => {
  dropNonContentElements(root);
  mergeHeadingGroups(root);
  stripPresentationalAttributes(root);
  unwrapLayoutContainers(root);
  removeEmptyParagraphs(root);
};

/**
 * Serialises the content of an element (not the element itself) to HTML.
 *
 * @param root - Element whose children are serialised.
 * @returns The inner HTML.
 */
export const serialize = (root: Element): string => root.innerHTML;
