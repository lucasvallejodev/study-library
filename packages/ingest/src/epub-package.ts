import type JSZip from 'jszip';
import path from 'node:path/posix';

import {
  type ContainerXml,
  type OpfMetadata,
  type OpfPackage,
  xmlParser,
  xmlText,
} from './epub-xml';
import { Patterns } from './patterns';
import { stripHtmlTags } from './text';

const CONTAINER_PATH = 'META-INF/container.xml';
const ENCRYPTION_PATH = 'META-INF/encryption.xml';
const NCX_MEDIA_TYPE = 'application/x-dtbncx+xml';
const UNTITLED = 'Untitled';

const FontObfuscationAlgorithms = [
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- XML algorithm identifier, never fetched
  'http://www.idpf.org/2008/embedding',
  'http://ns.adobe.com/pdf/enc#RC',
];

/** Bibliographic data of an EPUB, read from its OPF package file. */
export type EpubMetadata = {
  authors: string[];
  coverPath?: string;
  description?: string;
  language?: string;
  title: string;
};

/** A manifest entry: archive path, media type and `properties` tokens. */
export type ManifestItem = {
  href: string;
  mediaType: string;
  properties: string;
};

/** Everything read from the OPF package file. */
export type EpubPackage = {
  manifest: Map<string, ManifestItem>;
  metadata: EpubMetadata;
  navPath?: string;
  ncxPath?: string;
  opfPath: string;
  spine: string[];
};

/**
 * Reads `META-INF/container.xml`, the entry point of every EPUB.
 *
 * @param zip - The opened EPUB archive.
 * @returns The container XML.
 * @throws An `Error` when the archive has no container file (it is not an EPUB).
 */
export const readContainerXml = async (zip: JSZip): Promise<string> => {
  const containerXml = await zip.file(CONTAINER_PATH)?.async('string');

  if (!containerXml) throw new Error('Not an EPUB: META-INF/container.xml missing');

  return containerXml;
};

/**
 * Rejects DRM-protected EPUBs.
 *
 * @remarks
 * Font obfuscation (IDPF and Adobe) is allowed; any other encryption method in
 * `META-INF/encryption.xml` means DRM.
 *
 * @param zip - The opened EPUB archive.
 * @throws An `Error` when the archive declares a non-font encryption method.
 */
export const assertNotDrmProtected = async (zip: JSZip): Promise<void> => {
  const encryption = await zip.file(ENCRYPTION_PATH)?.async('string');

  if (encryption === undefined) return;

  const isDrm = [...encryption.matchAll(Patterns.encryptionAlgorithm)].some(
    match => !FontObfuscationAlgorithms.includes(match[1])
  );

  if (isDrm) {
    throw new Error(
      'This EPUB is DRM-protected and cannot be imported. Only DRM-free books are supported.'
    );
  }
};

/**
 * Finds the OPF package file named by the container.
 *
 * @param containerXml - Content of `META-INF/container.xml`.
 * @returns Archive path of the first rootfile.
 * @throws An `Error` when the container lists no rootfile.
 */
export const rootfilePath = (containerXml: string): string => {
  const container = xmlParser.parse(containerXml) as ContainerXml | undefined;
  const rootfiles = container?.container?.rootfiles?.rootfile ?? [];
  const opfPath = rootfiles[0]?.['@_full-path'];

  if (!opfPath) throw new Error('EPUB container.xml has no rootfile');

  return opfPath;
};

const readManifest = (opf: OpfPackage, opfPath: string): Map<string, ManifestItem> => {
  const manifest = new Map<string, ManifestItem>();

  for (const item of opf.manifest?.item ?? []) {
    manifest.set(item['@_id'], {
      href: path.normalize(path.join(path.dirname(opfPath), decodeURIComponent(item['@_href']))),
      mediaType: item['@_media-type'] ?? '',
      properties: item['@_properties'] ?? '',
    });
  }

  return manifest;
};

const readSpine = (opf: OpfPackage, manifest: Map<string, ManifestItem>): string[] =>
  (opf.spine?.itemref ?? [])
    .map(reference => manifest.get(reference['@_idref'])?.href)
    .filter((href): href is string => !!href);

const findByProperty = (
  manifest: Map<string, ManifestItem>,
  property: string
): string | undefined =>
  [...manifest.values()].find(item =>
    item.properties.split(Patterns.whitespaceRun).includes(property)
  )?.href;

const findCoverPath = (
  manifest: Map<string, ManifestItem>,
  metadata: OpfMetadata
): string | undefined => {
  const coverImage = findByProperty(manifest, 'cover-image');

  if (coverImage) return coverImage;
  const coverMeta = (metadata.meta ?? []).find(meta => meta['@_name'] === 'cover');

  return coverMeta ? manifest.get(coverMeta['@_content'])?.href : undefined;
};

const findNcxPath = (opf: OpfPackage, manifest: Map<string, ManifestItem>): string | undefined => {
  const tocId = opf.spine?.['@_toc'];
  const spineToc = tocId ? manifest.get(tocId)?.href : undefined;

  return spineToc || [...manifest.values()].find(item => item.mediaType === NCX_MEDIA_TYPE)?.href;
};

const readMetadata = (metadata: OpfMetadata, coverPath: string | undefined): EpubMetadata => ({
  authors: (metadata.creator ?? []).map(xmlText).filter(Boolean),
  coverPath,
  description: stripHtmlTags(xmlText(metadata.description)) || undefined,
  language: xmlText(metadata.language) || undefined,
  title: xmlText((metadata.title ?? [])[0]) || UNTITLED,
});

/**
 * Reads the OPF package file: manifest, spine, metadata, cover and table-of-contents files.
 *
 * @param opfXml - Content of the OPF file.
 * @param opfPath - Archive path of the OPF file; manifest hrefs are relative to it.
 * @returns The package contents.
 */
export const readPackage = (opfXml: string, opfPath: string): EpubPackage => {
  const opf = (xmlParser.parse(opfXml) as { package: OpfPackage }).package;
  const metadata = opf.metadata ?? {};
  const manifest = readManifest(opf, opfPath);

  return {
    manifest,
    metadata: readMetadata(metadata, findCoverPath(manifest, metadata)),
    navPath: findByProperty(manifest, 'nav'),
    ncxPath: findNcxPath(opf, manifest),
    opfPath,
    spine: readSpine(opf, manifest),
  };
};
