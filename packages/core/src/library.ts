import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

import { isSlugId, Patterns } from './patterns';
import {
  type ChapterEntry,
  type ChapterFrontmatter,
  ChapterFrontmatterSchema,
  DocumentSchema,
  type LibraryDocument,
} from './schemas';

const WORKSPACE_MARKER = 'pnpm-workspace.yaml';
const DOCUMENT_FILE = 'document.json';
const JSON_INDENT = 2;

let cachedRepoRoot: string | undefined;

const searchRepoRoot = (): string => {
  let dir = process.cwd();

  while (true) {
    if (existsSync(path.join(dir, WORKSPACE_MARKER))) return dir;
    const parent = path.dirname(dir);

    if (parent === dir) return process.cwd();
    dir = parent;
  }
};

/**
 * Finds the root of the pnpm workspace by walking up from the working directory.
 *
 * @remarks
 * The result is cached for the life of the process. Falls back to the working directory
 * when no `pnpm-workspace.yaml` is found.
 *
 * @returns The absolute path of the repository root.
 */
export const findRepoRoot = (): string => {
  cachedRepoRoot ??= searchRepoRoot();

  return cachedRepoRoot;
};

/**
 * Locates the root of the on-disk library.
 *
 * @remarks
 * `LIBRARY_DIR` wins, resolved against the repository root; otherwise `<repo>/library`.
 *
 * @returns The absolute path of the library folder.
 */
export const libraryDir = (): string => {
  const configured = process.env.LIBRARY_DIR;

  if (configured) return path.resolve(findRepoRoot(), configured);

  return path.join(findRepoRoot(), 'library');
};

/**
 * Locates the repo-level scratch folder for uploads and agent work.
 *
 * @returns The absolute path of `<repo>/_temp`.
 */
export const tempDir = (): string => path.join(findRepoRoot(), '_temp');

/**
 * Locates the folder of one document in the library.
 *
 * @param docId - Document id (a lowercase slug).
 * @returns The absolute path of `library/<docId>`.
 * @throws Error when `docId` is not a valid slug, so it can never escape the library.
 */
export const documentDir = (docId: string): string => {
  if (!isSlugId(docId)) throw new Error(`Invalid document id: ${docId}`);

  return path.join(libraryDir(), docId);
};

/**
 * Resolves a path inside a document folder, refusing anything that escapes it.
 *
 * @param docId - Document id (a lowercase slug).
 * @param relative - Path relative to the document folder.
 * @returns The absolute resolved path.
 * @throws Error when `docId` is invalid or the path points outside the document folder.
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
 * Hashes content with SHA-256.
 *
 * @param content - Text (hashed as UTF-8) or raw bytes.
 * @returns The lowercase hex digest.
 */
export const sha256 = (content: string | Buffer): string =>
  createHash('sha256').update(content).digest('hex');

/**
 * Computes the `contentHash` stored for a chapter in `document.json`.
 *
 * @param markdown - Chapter body, without frontmatter.
 * @returns The hash prefixed with its algorithm, such as `sha256:ab12…`.
 */
export const contentHash = (markdown: string): string => `sha256:${sha256(markdown)}`;

/**
 * Counts the words of a Markdown text, ignoring markup.
 *
 * @param markdown - Markdown source.
 * @returns The number of words (runs of letters and digits, with inner apostrophes and dashes).
 */
export const countWords = (markdown: string): number => {
  const words = stripMarkdown(markdown).match(Patterns.word);

  return words ? words.length : 0;
};

const removeCodeFenceMarkers = (codeBlock: string): string =>
  codeBlock.replace(Patterns.codeFenceMarker, '');

/**
 * Converts Markdown to rough plain text for search indexing and word counts.
 *
 * @remarks
 * Drops frontmatter, images, HTML tags, footnote markers and inline symbols, keeps link
 * text and code, and collapses whitespace. Not a faithful renderer.
 *
 * @param markdown - Markdown source, with or without frontmatter.
 * @returns Single-line plain text.
 */
export const stripMarkdown = (markdown: string): string =>
  markdown
    .replace(Patterns.frontmatterBlock, '')
    .replace(Patterns.codeFence, removeCodeFenceMarkers)
    .replace(Patterns.markdownImage, ' ')
    .replace(Patterns.markdownLinkWithText, '$1')
    .replace(Patterns.htmlTag, ' ')
    .replace(Patterns.footnoteMarker, ' ')
    .replace(Patterns.inlineMarkdownSymbols, ' ')
    .replace(Patterns.whitespaceRun, ' ')
    .trim();

const compareCodeUnits = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;

  return 0;
};

/**
 * Lists the ids of every document folder in the library.
 *
 * @remarks
 * Only folders that contain a `document.json` count; hidden folders are skipped.
 *
 * @returns The document ids in code-unit order, or an empty list when the library is missing.
 */
export const listDocumentIds = async (): Promise<string[]> => {
  const root = libraryDir();

  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });

  return entries
    .filter(
      entry =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        existsSync(path.join(root, entry.name, DOCUMENT_FILE))
    )
    .map(entry => entry.name)
    .sort(compareCodeUnits);
};

/**
 * Reads and validates a document's `document.json`.
 *
 * @param docId - Document id (a lowercase slug).
 * @returns The parsed document, with schema defaults applied.
 * @throws Error when the id is invalid, the file cannot be read, or it fails validation.
 */
export const readDocument = async (docId: string): Promise<LibraryDocument> => {
  const raw = await readFile(path.join(documentDir(docId), DOCUMENT_FILE), 'utf8');

  return DocumentSchema.parse(JSON.parse(raw));
};

/**
 * Validates a document and writes it as `document.json`.
 *
 * @param doc - The document to write.
 * @param dir - Target folder; defaults to the document's folder in the library.
 * @returns Resolves once the file is written.
 * @throws ZodError when the document fails validation.
 */
export const writeDocument = async (
  doc: LibraryDocument,
  dir = documentDir(doc.id)
): Promise<void> => {
  const valid = DocumentSchema.parse(doc);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, DOCUMENT_FILE), JSON.stringify(valid, null, JSON_INDENT) + '\n');
};

/**
 * Tells whether a document exists in the library.
 *
 * @param docId - Document id (a lowercase slug).
 * @returns True when its `document.json` is on disk.
 * @throws Error when the id is invalid.
 */
export const documentExists = (docId: string): boolean =>
  existsSync(path.join(documentDir(docId), DOCUMENT_FILE));

/**
 * Builds the contents of a chapter file: YAML frontmatter followed by the Markdown body.
 *
 * @param front - Chapter frontmatter.
 * @param body - Chapter Markdown; surrounding whitespace is trimmed.
 * @returns The file contents, ending in a newline.
 * @throws ZodError when the frontmatter fails validation.
 */
export const buildChapterFile = (front: ChapterFrontmatter, body: string): string => {
  const yaml = YAML.stringify(ChapterFrontmatterSchema.parse(front), { lineWidth: 0 }).trimEnd();

  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
};

/**
 * Splits a chapter file into its frontmatter and body.
 *
 * @remarks
 * The frontmatter is not validated. A file without frontmatter is returned whole as body.
 *
 * @param content - Contents of a chapter file.
 * @returns The Markdown body and the parsed frontmatter fields.
 */
export const parseChapterFile = (
  content: string
): { body: string; front: Partial<ChapterFrontmatter> } => {
  const match = Patterns.frontmatterWithBody.exec(content);

  if (!match) return { body: content, front: {} };

  return {
    body: content.slice(match[0].length),
    front: (YAML.parse(match[1]) ?? {}) as Partial<ChapterFrontmatter>,
  };
};

/**
 * Reads the Markdown body of one chapter from disk.
 *
 * @param docId - Document id (a lowercase slug).
 * @param chapter - The chapter's entry in `document.json`.
 * @returns The chapter body, without frontmatter.
 * @throws Error when the path escapes the document folder or the file cannot be read.
 */
export const readChapterBody = async (docId: string, chapter: ChapterEntry): Promise<string> => {
  const raw = await readFile(resolveInDocument(docId, chapter.file), 'utf8');

  return parseChapterFile(raw).body;
};

/**
 * Replaces a document folder with a freshly built one.
 *
 * @remarks
 * Build in a sibling temp folder, then swap: the old folder is renamed aside, the new one
 * moved into place, and only then is the old one removed.
 *
 * @param docId - Document id (a lowercase slug).
 * @param buildDir - Folder holding the finished document.
 * @returns Resolves once the swap is complete.
 * @throws Error when the id is invalid or a rename fails.
 */
export const replaceDocumentDir = async (docId: string, buildDir: string): Promise<void> => {
  const target = documentDir(docId);
  const old = `${target}.old-${Date.now()}`;

  if (existsSync(target)) await rename(target, old);
  await rename(buildDir, target);
  if (existsSync(old)) await rm(old, { force: true, recursive: true });
};

/**
 * Builds the reader URL path of a chapter, optionally scrolled to an annotation.
 *
 * @param docId - Document id.
 * @param chapterId - Chapter id.
 * @param annotationId - Annotation to jump to, used as the URL fragment.
 * @returns A path such as `/read/alice/ch-001#a-k3x9q0`.
 */
export const chapterRoute = (docId: string, chapterId: string, annotationId?: string): string => {
  const fragment = annotationId ? `#${annotationId}` : '';

  return `/read/${docId}/${chapterId}${fragment}`;
};
