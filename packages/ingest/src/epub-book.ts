import JSZip from 'jszip';

import {
  assertNotDrmProtected,
  type EpubMetadata,
  type EpubPackage,
  type ManifestItem,
  readContainerXml,
  readPackage,
  rootfilePath,
} from './epub-package';
import { parseXhtml } from './html';
import type { Warning } from './writer';

/** An opened EPUB: its package data, lazily parsed content files and the import warnings. */
export class EpubBook {
  readonly manifest: Map<string, ManifestItem>;
  readonly metadata: EpubMetadata;
  readonly navPath: string | undefined;
  readonly ncxPath: string | undefined;
  readonly opfPath: string;
  readonly spine: string[];
  readonly warnings: Warning[] = [];
  private readonly parsedDocuments = new Map<string, Document>();

  private constructor(
    private readonly zip: JSZip,
    epubPackage: EpubPackage
  ) {
    this.manifest = epubPackage.manifest;
    this.metadata = epubPackage.metadata;
    this.navPath = epubPackage.navPath;
    this.ncxPath = epubPackage.ncxPath;
    this.opfPath = epubPackage.opfPath;
    this.spine = epubPackage.spine;
  }

  static async load(data: Buffer): Promise<EpubBook> {
    const zip = await JSZip.loadAsync(data);
    const containerXml = await readContainerXml(zip);

    await assertNotDrmProtected(zip);
    const opfPath = rootfilePath(containerXml);
    const opfXml = await zip.file(opfPath)?.async('string');

    if (!opfXml) throw new Error(`EPUB OPF not found at ${opfPath}`);

    return new EpubBook(zip, readPackage(opfXml, opfPath));
  }

  async doc(filePath: string): Promise<Document | undefined> {
    if (this.parsedDocuments.has(filePath)) return this.parsedDocuments.get(filePath);
    const raw = await this.text(filePath);

    if (raw === undefined) return undefined;
    const document = parseXhtml(raw);

    this.parsedDocuments.set(filePath, document);

    return document;
  }

  async file(filePath: string): Promise<Buffer | undefined> {
    const entry = this.zip.file(filePath);

    return entry ? Buffer.from(await entry.async('uint8array')) : undefined;
  }

  async text(filePath: string): Promise<string | undefined> {
    return this.zip.file(filePath)?.async('string');
  }
}
