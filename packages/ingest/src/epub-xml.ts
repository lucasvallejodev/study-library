import { XMLParser } from 'fast-xml-parser';
import path from 'node:path/posix';

const TEXT_NODE = '#text';

const RepeatableElements = [
  'item',
  'itemref',
  'meta',
  'creator',
  'navPoint',
  'rootfile',
  'title',
  'language',
  'description',
];

/** Parser for EPUB package files: attributes as `@_name`, namespaces dropped, lists as arrays. */
export const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  isArray: name => RepeatableElements.includes(name),
  removeNSPrefix: true,
  textNodeName: TEXT_NODE,
});

/** `META-INF/container.xml` as parsed by {@link xmlParser}. */
export type ContainerXml = {
  container?: { rootfiles?: { rootfile?: { '@_full-path'?: string }[] } };
};

/** One `<item>` of the OPF manifest. */
export type OpfItem = {
  '@_href': string;
  '@_id': string;
  '@_media-type'?: string;
  '@_properties'?: string;
};

/** The OPF `<metadata>` element (Dublin Core fields keep their text in `#text`). */
export type OpfMetadata = {
  creator?: unknown[];
  description?: unknown;
  language?: unknown;
  meta?: { '@_content': string; '@_name'?: string }[];
  title?: unknown[];
};

/** The OPF `<package>` element. */
export type OpfPackage = {
  manifest?: { item?: OpfItem[] };
  metadata?: OpfMetadata;
  spine?: { '@_toc'?: string; itemref?: { '@_idref': string }[] };
};

/** One `<navPoint>` of an EPUB 2 NCX table of contents. */
export type NcxNavPoint = {
  content?: { '@_src'?: string };
  navLabel?: { text?: unknown };
  navPoint?: NcxNavPoint[];
};

/** An NCX file as parsed by {@link xmlParser}. */
export type NcxDocument = { ncx?: { navMap?: { navPoint?: NcxNavPoint[] } } };

/**
 * Reads the trimmed text of a parsed XML value (a string, a number, the first of a list, or an
 * element's `#text`).
 *
 * @param value - Value produced by {@link xmlParser}.
 * @returns The text, or an empty string when there is none.
 */
export const xmlText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return xmlText(value[0]);
  if (typeof value === 'object' && TEXT_NODE in value) return xmlText(value[TEXT_NODE]);

  return '';
};

/** A file inside the EPUB plus an optional `#fragment` within it. */
export type EpubHref = { file: string; fragment?: string };

/**
 * Resolves an href found in an EPUB file to a path inside the archive and a fragment.
 *
 * @param href - Reference as written (`../text/chapter-1.xhtml#note-3`); an empty path points at
 * `baseFile` itself.
 * @param baseFile - Archive path of the file the href appears in.
 * @returns The decoded archive path and, when present, the decoded fragment.
 */
export const resolveHref = (href: string, baseFile: string): EpubHref => {
  const [rawPath, fragment] = href.split('#');
  const decoded = decodeURIComponent(rawPath ?? '');
  const file = decoded ? path.normalize(path.join(path.dirname(baseFile), decoded)) : baseFile;

  return fragment ? { file, fragment: decodeURIComponent(fragment) } : { file };
};
