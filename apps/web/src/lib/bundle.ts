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
  type LibraryDocument,
  parseChapterFile,
  readDocument,
  resolveInDocument,
  writeDocument,
} from '@study/core';
import { indexDocument } from '@study/core/db';

import { getDb } from './db';
import { HttpError } from './http';

/**
 * Everything an agent needs to edit a document: document.json, chapter files, import report.
 *
 * @param docId
 */
export const readBundle = async (docId: string) => {
  const document = await readDocument(docId);
  const files: Record<string, string> = {};

  for (const ch of document.chapters) {
    files[ch.file] = await readFile(resolveInDocument(docId, ch.file), 'utf8');
  }

  const reportPath = resolveInDocument(docId, 'import-report.json');
  const report = existsSync(reportPath) ? JSON.parse(await readFile(reportPath, 'utf8')) : null;

  const assets = existsSync(resolveInDocument(docId, 'assets'))
    ? await readdir(resolveInDocument(docId, 'assets'))
    : [];

  return {
    assets,
    document,
    files,
    report,
  };
};

export const BundleInputSchema = z.object({
  document: z.unknown(),
  files: z.record(z.string(), z.string()),
});

/**
 * Apply an edited bundle: validates document.json, rewrites chapter frontmatter, recomputes
 * hashes and word counts, deletes chapter files no longer listed, and re-indexes.
 * Chapter ids must stay stable for existing chapters, or their annotations lose their place.
 *
 * @param docId
 * @param input
 */
export const writeBundle = async (
  docId: string,
  input: z.infer<typeof BundleInputSchema>
): Promise<LibraryDocument> => {
  const candidate = input.document as Record<string, unknown>;

  // Hashes and counts are derived, so callers may omit them.
  const chapters = Array.isArray(candidate?.chapters)
    ? (candidate.chapters as Record<string, unknown>[])
    : [];

  const prepared = chapters.map((c, i) => {
    const file = String(c.file ?? '');
    const raw = input.files[file];

    if (raw === undefined) {
      throw new HttpError(400, `Chapter ${c.id} lists ${file}, but that file is not in the bundle`);
    }

    const body = parseChapterFile(raw).body.trim();

    return {
      ...c,
      body,
      contentHash: contentHash(body),
      order: i + 1,
      wordCount: countWords(body),
    };
  });

  const parsed = DocumentSchema.safeParse({
    ...candidate,
    chapters: prepared.map(({ body: _b, ...c }) => c),
  });

  if (!parsed.success) {
    throw new HttpError(
      400,
      `Invalid document.json: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`
    );
  }

  const doc = parsed.data;

  if (doc.id !== docId) throw new HttpError(400, `document.id must stay "${docId}"`);
  const ids = new Set<string>();

  for (const c of doc.chapters) {
    if (ids.has(c.id)) throw new HttpError(400, `Duplicate chapter id ${c.id}`);
    ids.add(c.id);
  }

  for (const [i, c] of doc.chapters.entries()) {
    await writeFile(
      resolveInDocument(docId, c.file),
      buildChapterFile(
        {
          document: docId,
          id: c.id,
          order: c.order,
          title: c.title,
        },
        prepared[i].body
      )
    );
  }

  const keep = new Set(doc.chapters.map(c => path.basename(c.file)));

  for (const f of await readdir(resolveInDocument(docId, 'chapters'))) {
    if (!keep.has(f)) await rm(resolveInDocument(docId, `chapters/${f}`));
  }

  await writeDocument(doc);
  await indexDocument(getDb(), docId);

  return doc;
};
