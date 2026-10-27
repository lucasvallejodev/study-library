import 'server-only';

import { existsSync } from 'node:fs';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import {
  buildChapterFile,
  contentHash,
  countWords,
  DocumentSchema,
  type ImportReport,
  type LibraryDocument,
  parseChapterFile,
  readDocument,
  resolveInDocument,
  writeDocument,
} from '@study/core';
import { indexDocument } from '@study/core/db';

import { getDb } from './db';
import { badRequest } from './http';
import { readImportReport } from './import-report';

/** Everything an agent needs to edit a document. */
export type DocumentBundle = {
  assets: string[];
  document: LibraryDocument;
  files: Record<string, string>;
  report: ImportReport | null;
};

/** Body of `PUT /api/documents/:doc/bundle`: the edited `document.json` and chapter files. */
export const BundleInputSchema = z.object({
  document: z.unknown(),
  files: z.record(z.string(), z.string()),
});

/** A parsed {@link BundleInputSchema} body. */
export type BundleInput = z.infer<typeof BundleInputSchema>;

type ChapterCandidate = Record<string, unknown>;

type PreparedChapter = {
  body: string;
  entry: ChapterCandidate;
};

const ASSETS_DIR = 'assets';
const CHAPTERS_DIR = 'chapters';

const readChapterFiles = async (document: LibraryDocument): Promise<Record<string, string>> => {
  const files: Record<string, string> = {};

  for (const chapter of document.chapters) {
    files[chapter.file] = await readFile(resolveInDocument(document.id, chapter.file), 'utf8');
  }

  return files;
};

const listAssets = async (docId: string): Promise<string[]> => {
  const assetsDir = resolveInDocument(docId, ASSETS_DIR);

  return existsSync(assetsDir) ? readdir(assetsDir) : [];
};

/**
 * Reads everything an agent needs to edit a document: `document.json`, chapter files, the
 * import report and the asset file names.
 *
 * @param docId - Document slug.
 * @returns The bundle; chapter files are keyed by their path inside the document folder.
 */
export const readBundle = async (docId: string): Promise<DocumentBundle> => {
  const document = await readDocument(docId);
  const files = await readChapterFiles(document);
  const report = await readImportReport(docId);
  const assets = await listAssets(docId);

  return {
    assets,
    document,
    files,
    report,
  };
};

const chapterCandidates = (candidate: ChapterCandidate | null): ChapterCandidate[] =>
  Array.isArray(candidate?.chapters) ? (candidate.chapters as ChapterCandidate[]) : [];

const prepareChapter = (
  entry: ChapterCandidate,
  index: number,
  files: BundleInput['files']
): PreparedChapter => {
  const file = String((entry.file as string | undefined) ?? '');
  const raw = files[file] as string | undefined;

  if (raw === undefined) {
    return badRequest(
      `Chapter ${String(entry.id)} lists ${file}, but that file is not in the bundle`
    );
  }

  const body = parseChapterFile(raw).body.trim();

  return {
    body,
    entry: {
      ...entry,
      contentHash: contentHash(body),
      order: index + 1,
      wordCount: countWords(body),
    },
  };
};

const formatIssues = (error: z.ZodError): string =>
  error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');

const parseDocument = (
  candidate: ChapterCandidate | null,
  prepared: PreparedChapter[]
): LibraryDocument => {
  const parsed = DocumentSchema.safeParse({
    ...candidate,
    chapters: prepared.map(chapter => chapter.entry),
  });

  if (!parsed.success) return badRequest(`Invalid document.json: ${formatIssues(parsed.error)}`);

  return parsed.data;
};

const assertStableIds = (doc: LibraryDocument, docId: string): void => {
  if (doc.id !== docId) badRequest(`document.id must stay "${docId}"`);

  const seen = new Set<string>();

  for (const chapter of doc.chapters) {
    if (seen.has(chapter.id)) badRequest(`Duplicate chapter id ${chapter.id}`);
    seen.add(chapter.id);
  }
};

const writeChapterFiles = async (
  doc: LibraryDocument,
  prepared: PreparedChapter[]
): Promise<void> => {
  for (const [index, chapter] of doc.chapters.entries()) {
    const frontmatter = {
      document: doc.id,
      id: chapter.id,
      order: chapter.order,
      title: chapter.title,
    };

    await writeFile(
      resolveInDocument(doc.id, chapter.file),
      buildChapterFile(frontmatter, prepared[index].body)
    );
  }
};

const removeUnlistedChapterFiles = async (doc: LibraryDocument): Promise<void> => {
  const listed = new Set(doc.chapters.map(chapter => path.basename(chapter.file)));

  for (const fileName of await readdir(resolveInDocument(doc.id, CHAPTERS_DIR))) {
    if (!listed.has(fileName)) await rm(resolveInDocument(doc.id, `${CHAPTERS_DIR}/${fileName}`));
  }
};

/**
 * Applies an edited bundle to a document and re-indexes it.
 *
 * @remarks
 * Validates `document.json`, rewrites chapter frontmatter, recomputes order, content hashes and
 * word counts (so callers may omit them) and deletes chapter files no longer listed. Chapter ids
 * must stay stable for existing chapters, or their annotations lose their place.
 *
 * @param docId - Document slug; the bundle's `document.id` must match it.
 * @param input - The edited bundle.
 * @returns The document as written.
 * @throws {@link HttpError} 400 when a listed chapter file is missing from the bundle,
 * `document.json` is invalid, the id changed or chapter ids repeat.
 */
export const writeBundle = async (docId: string, input: BundleInput): Promise<LibraryDocument> => {
  const candidate = input.document as ChapterCandidate | null;

  const prepared = chapterCandidates(candidate).map((entry, index) =>
    prepareChapter(entry, index, input.files)
  );

  const doc = parseDocument(candidate, prepared);

  assertStableIds(doc, docId);
  await writeChapterFiles(doc, prepared);
  await removeUnlistedChapterFiles(doc);
  await writeDocument(doc);
  await indexDocument(getDb(), docId);

  return doc;
};
