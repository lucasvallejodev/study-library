import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

import {
  type ChapterEntry,
  type ChapterFrontmatter,
  ChapterFrontmatterSchema,
  DocumentSchema,
  type LibraryDocument,
} from './schemas';

/** Root of the on-disk library. LIBRARY_DIR wins; otherwise `<repo>/library`. */
export const libraryDir = (): string => {
  const configured = process.env.LIBRARY_DIR;

  if (configured) return path.resolve(findRepoRoot(), configured);

  return path.join(findRepoRoot(), 'library');
};

/** Repo-level scratch folder for uploads and agent work. */
export const tempDir = (): string => path.join(findRepoRoot(), '_temp');

let repoRoot: string | undefined;

/**
 *
 */
export const findRepoRoot = (): string => {
  if (repoRoot) return repoRoot;
  let dir = process.cwd();

  while (true) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return (repoRoot = dir);
    const parent = path.dirname(dir);

    if (parent === dir) return (repoRoot = process.cwd());
    dir = parent;
  }
};

/**
 *
 * @param docId
 */
export const documentDir = (docId: string): string => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(docId)) throw new Error(`Invalid document id: ${docId}`);

  return path.join(libraryDir(), docId);
};

/**
 * Resolve a path inside a document folder, refusing anything that escapes it.
 *
 * @param docId
 * @param relative
 */
export const resolveInDocument = (docId: string, relative: string): string => {
  const base = documentDir(docId);
  const full = path.resolve(base, relative);

  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error(`Path escapes document folder: ${relative}`);
  }

  return full;
};

/**
 *
 * @param content
 */
export const sha256 = (content: string | Buffer): string =>
  createHash('sha256').update(content).digest('hex');

/**
 *
 * @param markdown
 */
export const contentHash = (markdown: string): string => `sha256:${sha256(markdown)}`;

/**
 *
 * @param markdown
 */
export const countWords = (markdown: string): number => {
  const text = stripMarkdown(markdown);
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);

  return words ? words.length : 0;
};

/**
 * Rough Markdown-to-text for search indexing and word counts.
 *
 * @param markdown
 */
export const stripMarkdown = (markdown: string): string =>
  markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*/g, ''))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\^[^\]]+\]:?/g, ' ')
    .replace(/[*_`~#>|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 *
 */
export const listDocumentIds = async (): Promise<string[]> => {
  const root = libraryDir();

  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });

  return entries
    .filter(
      e =>
        e.isDirectory() &&
        !e.name.startsWith('.') &&
        existsSync(path.join(root, e.name, 'document.json'))
    )
    .map(e => e.name)
    .sort();
};

/**
 *
 * @param docId
 */
export const readDocument = async (docId: string): Promise<LibraryDocument> => {
  const raw = await readFile(path.join(documentDir(docId), 'document.json'), 'utf8');

  return DocumentSchema.parse(JSON.parse(raw));
};

/**
 *
 * @param doc
 * @param dir
 */
export const writeDocument = async (
  doc: LibraryDocument,
  dir = documentDir(doc.id)
): Promise<void> => {
  const valid = DocumentSchema.parse(doc);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'document.json'), JSON.stringify(valid, null, 2) + '\n');
};

/**
 *
 * @param docId
 */
export const documentExists = (docId: string): boolean =>
  existsSync(path.join(documentDir(docId), 'document.json'));

/**
 *
 * @param front
 * @param body
 */
export const buildChapterFile = (front: ChapterFrontmatter, body: string): string => {
  const yaml = YAML.stringify(ChapterFrontmatterSchema.parse(front), { lineWidth: 0 }).trimEnd();

  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
};

/**
 *
 * @param content
 */
export const parseChapterFile = (
  content: string
): { body: string; front: Partial<ChapterFrontmatter> } => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);

  if (!match) return { body: content, front: {} };

  return {
    body: content.slice(match[0].length),
    front: (YAML.parse(match[1]) ?? {}) as Partial<ChapterFrontmatter>,
  };
};

/**
 *
 * @param docId
 * @param chapter
 */
export const readChapterBody = async (docId: string, chapter: ChapterEntry): Promise<string> => {
  const raw = await readFile(resolveInDocument(docId, chapter.file), 'utf8');

  return parseChapterFile(raw).body;
};

/**
 * Write a finished document folder atomically: build in a sibling temp dir, then swap.
 *
 * @param docId
 * @param buildDir
 */
export const replaceDocumentDir = async (docId: string, buildDir: string): Promise<void> => {
  const target = documentDir(docId);
  const old = `${target}.old-${Date.now()}`;

  if (existsSync(target)) await rename(target, old);
  await rename(buildDir, target);
  if (existsSync(old)) await rm(old, { force: true, recursive: true });
};

/**
 *
 * @param docId
 * @param chapterId
 * @param annotationId
 */
export const chapterRoute = (docId: string, chapterId: string, annotationId?: string): string =>
  `/read/${docId}/${chapterId}${annotationId ? `#${annotationId}` : ''}`;
