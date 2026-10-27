import { documentExists, type ImportReport, type LibraryDocument, slugify } from '@study/core';
import type { Db } from '@study/core/db';

import type { Fetcher } from './url';

/** Thrown when an import would overwrite an existing document. */
export class DocumentExistsError extends Error {
  constructor(readonly documentId: string) {
    super(
      `A document with id "${documentId}" already exists. Use \`lib reimport ${documentId}\` or pass --id to import a copy.`
    );
  }
}

/**
 * Options of an import.
 *
 * @remarks
 * - `db`: index the result in PostgreSQL when given.
 * - `fetcher`: how web pages and images are downloaded (defaults to `fetch`).
 * - `id`: explicit document id; defaults to a slug of the title.
 * - `log`: receives progress messages.
 * - `previous`: internal; re-importing keeps the id and stable chapter ids.
 * - `sourceUrl`: for local `.html` files, the page's original URL (resolves relative images).
 * - `tocDepth`: deepest TOC level used as a chapter start (EPUB).
 */
export type ImportOptions = {
  db?: Db;
  fetcher?: Fetcher;
  id?: string;
  log?: (message: string) => void;
  previous?: LibraryDocument;
  sourceUrl?: string;
  tocDepth?: number;
};

/** The imported document and its import report. */
export type ImportResult = { document: LibraryDocument; report: ImportReport };

/** Receives progress messages. */
export type Logger = (message: string) => void;

const ignoreMessage: Logger = () => undefined;

/**
 * Returns the progress logger of an import.
 *
 * @param opts - Import options.
 * @returns `opts.log`, or a logger that ignores every message.
 */
export const importLogger = (opts: ImportOptions): Logger => opts.log ?? ignoreMessage;

/**
 * Picks the id of the document being imported.
 *
 * @param title - Document title, slugified when no explicit id is given.
 * @param opts - Import options: `previous` keeps its id, `id` is slugified.
 * @returns The document id.
 * @throws {@link DocumentExistsError} when a new import would reuse an existing id.
 */
export const resolveDocumentId = (title: string, opts: ImportOptions): string => {
  if (opts.previous) return opts.previous.id;
  const id = slugify(opts.id || title);

  if (documentExists(id)) throw new DocumentExistsError(id);

  return id;
};

/**
 * Timestamp recorded as the document source's `importedAt`.
 *
 * @returns The current time as an ISO 8601 string.
 */
export const importTimestamp = (): string => new Date().toISOString();
