import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { ChapterFrontmatterSchema, DocumentSchema, type ChapterEntry, type ChapterFrontmatter, type LibraryDocument } from "./schemas";

/** Root of the on-disk library. LIBRARY_DIR wins; otherwise `<repo>/library`. */
export function libraryDir(): string {
  const configured = process.env.LIBRARY_DIR;
  if (configured) return path.resolve(findRepoRoot(), configured);
  return path.join(findRepoRoot(), "library");
}

/** Repo-level scratch folder for uploads and agent work. */
export function tempDir(): string {
  return path.join(findRepoRoot(), "_temp");
}

let repoRoot: string | undefined;
export function findRepoRoot(): string {
  if (repoRoot) return repoRoot;
  let dir = process.cwd();
  while (true) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return (repoRoot = dir);
    const parent = path.dirname(dir);
    if (parent === dir) return (repoRoot = process.cwd());
    dir = parent;
  }
}

export function documentDir(docId: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(docId)) throw new Error(`Invalid document id: ${docId}`);
  return path.join(libraryDir(), docId);
}

/** Resolve a path inside a document folder, refusing anything that escapes it. */
export function resolveInDocument(docId: string, relative: string): string {
  const base = documentDir(docId);
  const full = path.resolve(base, relative);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error(`Path escapes document folder: ${relative}`);
  return full;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function contentHash(markdown: string): string {
  return `sha256:${sha256(markdown)}`;
}

export function countWords(markdown: string): number {
  const text = stripMarkdown(markdown);
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}

/** Rough Markdown-to-text for search indexing and word counts. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, ""))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\^[^\]]+\]:?/g, " ")
    .replace(/[*_`~#>|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listDocumentIds(): Promise<string[]> {
  const root = libraryDir();
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && existsSync(path.join(root, e.name, "document.json")))
    .map((e) => e.name)
    .sort();
}

export async function readDocument(docId: string): Promise<LibraryDocument> {
  const raw = await readFile(path.join(documentDir(docId), "document.json"), "utf8");
  return DocumentSchema.parse(JSON.parse(raw));
}

export async function writeDocument(doc: LibraryDocument, dir = documentDir(doc.id)): Promise<void> {
  const valid = DocumentSchema.parse(doc);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "document.json"), JSON.stringify(valid, null, 2) + "\n");
}

export function documentExists(docId: string): boolean {
  return existsSync(path.join(documentDir(docId), "document.json"));
}

export function buildChapterFile(front: ChapterFrontmatter, body: string): string {
  const yaml = YAML.stringify(ChapterFrontmatterSchema.parse(front), { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

export function parseChapterFile(content: string): { front: Partial<ChapterFrontmatter>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { front: {}, body: content };
  return { front: (YAML.parse(match[1]!) ?? {}) as Partial<ChapterFrontmatter>, body: content.slice(match[0].length) };
}

export async function readChapterBody(docId: string, chapter: ChapterEntry): Promise<string> {
  const raw = await readFile(resolveInDocument(docId, chapter.file), "utf8");
  return parseChapterFile(raw).body;
}

/** Write a finished document folder atomically: build in a sibling temp dir, then swap. */
export async function replaceDocumentDir(docId: string, buildDir: string): Promise<void> {
  const target = documentDir(docId);
  const old = `${target}.old-${Date.now()}`;
  if (existsSync(target)) await rename(target, old);
  await rename(buildDir, target);
  if (existsSync(old)) await rm(old, { recursive: true, force: true });
}

export function chapterRoute(docId: string, chapterId: string, annotationId?: string): string {
  return `/read/${docId}/${chapterId}${annotationId ? `#${annotationId}` : ""}`;
}
