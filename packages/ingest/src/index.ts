import { existsSync } from "node:fs";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { documentDir, documentExists, readDocument, slugify, type LibraryDocument, type ImportReport } from "@study/core";
import type { Db } from "@study/core/db";
import { indexDocument } from "@study/core/db";
import { convertToEpub } from "./calibre";
import { EpubBook, convertEpub, sliceChapters } from "./epub";
import { parseMarkdownFile } from "./markdown";
import { defaultFetcher, processArticle, renderWithBrowser, type Fetcher } from "./url";
import { AssetStore, assignChapterIds, writeLibraryDocument, type Warning } from "./writer";

export { MissingToolError } from "./tools";
export { isMobiEncrypted } from "./calibre";
export type { Fetcher } from "./url";

export class DocumentExistsError extends Error {
  constructor(readonly documentId: string) {
    super(`A document with id "${documentId}" already exists. Use \`lib reimport ${documentId}\` or pass --id to import a copy.`);
  }
}

export type ImportOptions = {
  /** Explicit document id; defaults to a slug of the title. */
  id?: string;
  /** Max TOC depth used as chapter starts (EPUB). */
  tocDepth?: number;
  /** For local .html files: the page's original URL (resolves relative images). */
  sourceUrl?: string;
  /** Index the result in PostgreSQL when given. */
  db?: Db;
  fetcher?: Fetcher;
  log?: (message: string) => void;
  /** Internal: re-importing keeps the id and stable chapter ids. */
  previous?: LibraryDocument;
};

export type ImportResult = { document: LibraryDocument; report: ImportReport };

const EBOOK_EXT = new Set([".epub", ".mobi", ".azw", ".azw3", ".prc"]);

export function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

/** Import an EPUB/MOBI/AZW file, a saved .html page, or a web URL. */
export async function importSource(input: string, opts: ImportOptions = {}): Promise<ImportResult> {
  const log = opts.log ?? (() => {});
  let result: ImportResult;
  if (isUrl(input)) result = await importUrl(input, opts);
  else {
    const ext = path.extname(input).toLowerCase();
    if (!existsSync(input)) throw new Error(`File not found: ${input}`);
    if (ext === ".epub") result = await importEpubFile(input, opts);
    else if (EBOOK_EXT.has(ext)) result = await importKindleFile(input, opts);
    else if (ext === ".html" || ext === ".htm") result = await importHtmlFile(input, opts);
    else if (ext === ".md" || ext === ".markdown") result = await importMarkdownFile(input, opts);
    else if (ext === ".pdf") throw new Error("PDF import is planned for v0.3 and not supported yet.");
    else throw new Error(`Unsupported file type "${ext}". Supported: .epub, .mobi, .azw, .azw3, .html, .md, or an http(s) URL.`);
  }
  if (opts.db) {
    log("Indexing in PostgreSQL…");
    await indexDocument(opts.db, result.document.id);
  }
  log(`Imported "${result.document.title}" as ${result.document.id} with ${result.document.chapters.length} chapters.`);
  return result;
}

function resolveId(title: string, opts: ImportOptions): string {
  if (opts.previous) return opts.previous.id;
  const id = opts.id ? slugify(opts.id) : slugify(title);
  if (documentExists(id)) throw new DocumentExistsError(id);
  return id;
}

async function importEpubFile(file: string, opts: ImportOptions, sourceType: "epub" | "mobi" | "azw" | "azw3" = "epub", originalFile = file): Promise<ImportResult> {
  const log = opts.log ?? (() => {});
  log(`Reading ${path.basename(originalFile)}…`);
  const book = await EpubBook.load(await readFile(file));
  const id = resolveId(book.metadata.title, opts);
  const drafts = await sliceChapters(book, { tocDepth: opts.tocDepth });
  log(`Found ${drafts.length} chapters; converting with Pandoc…`);
  const ids = assignChapterIds(drafts.map((d) => d.title), opts.previous);
  const assets = new AssetStore();
  const chapters = await convertEpub(book, drafts, ids, id, assets);

  let cover: string | undefined;
  if (book.metadata.coverPath) {
    const data = await book.file(book.metadata.coverPath);
    if (data) cover = assets.add(data, path.extname(book.metadata.coverPath).slice(1));
  }
  const ext = path.extname(originalFile).toLowerCase() || ".epub";
  const sourceRel = `source/original${ext}`;
  const { doc, report } = await writeLibraryDocument({
    id,
    title: book.metadata.title,
    authors: book.metadata.authors,
    kind: "book",
    language: book.metadata.language,
    description: book.metadata.description,
    source: { type: sourceType, file: sourceRel, importedAt: new Date().toISOString() },
    cover,
    chapters,
    assets,
    sourceFiles: [{ relative: sourceRel, from: originalFile }],
    importer: sourceType === "epub" ? "epub" : `${sourceType}->epub (calibre)`,
    warnings: book.warnings,
  });
  return { document: doc, report };
}

async function importKindleFile(file: string, opts: ImportOptions): Promise<ImportResult> {
  const log = opts.log ?? (() => {});
  const ext = path.extname(file).toLowerCase().slice(1);
  const type = (ext === "prc" ? "mobi" : ext) as "mobi" | "azw" | "azw3";
  const tmp = await mkdtemp(path.join(os.tmpdir(), "study-lib-"));
  try {
    const epub = path.join(tmp, "converted.epub");
    log("Converting with Calibre (ebook-convert)…");
    await convertToEpub(file, epub);
    return await importEpubFile(epub, opts, type, file);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function finishArticle(html: string, url: string, opts: ImportOptions, warnings: Warning[]): Promise<ImportResult> {
  const assets = new AssetStore();
  const article = await processArticle(html, url, assets, warnings, opts.fetcher ?? defaultFetcher);
  const id = resolveId(article.page.title, opts);
  const ids = assignChapterIds(article.chapters.map((c) => c.title), opts.previous);
  let cover: string | undefined;
  if (article.page.image) {
    try {
      const res = await (opts.fetcher ?? defaultFetcher)(new URL(article.page.image, url).toString());
      if (res.ok && res.contentType.startsWith("image/")) cover = assets.add(res.body, res.contentType.split("/")[1]!.split(";")[0]!);
    } catch {
      // a missing cover is not worth a warning
    }
  }
  const { doc, report } = await writeLibraryDocument({
    id,
    title: article.page.title,
    authors: article.page.author ? [article.page.author] : [],
    kind: "article",
    description: article.page.description,
    source: {
      type: "url",
      url,
      importedAt: new Date().toISOString(),
      ...(article.page.published ? { publishedAt: article.page.published } : {}),
      file: "source/page.html",
    },
    cover,
    chapters: article.chapters.map((c, i) => ({ ...c, id: ids[i]! })),
    assets,
    sourceFiles: [{ relative: "source/page.html", content: html }],
    importer: "url (defuddle)",
    warnings,
  });
  return { document: doc, report };
}

async function importUrl(url: string, opts: ImportOptions): Promise<ImportResult> {
  const log = opts.log ?? (() => {});
  if (/\/\/[^/]*\/.*\.(epub|mobi|azw3?)(\?|$)/i.test(url)) throw new Error("Download the ebook first, then import the file.");
  log(`Fetching ${url}…`);
  const res = await (opts.fetcher ?? defaultFetcher)(url);
  if (!res.ok) throw new Error(`Fetching ${url} failed with HTTP ${res.status}`);
  let html = res.body.toString("utf8");
  const warnings: Warning[] = [];
  const probe = await processArticle(html, url, new AssetStore(), [], async () => ({ ok: false, status: 0, contentType: "", body: Buffer.alloc(0) }));
  if (probe.page.wordCount < 80) {
    log("Page looks empty; trying to render it with Playwright…");
    const rendered = await renderWithBrowser(url);
    if (rendered) {
      html = rendered;
      warnings.push({ code: "fetch-fallback", message: "Rendered with Playwright because the static HTML had little content" });
    } else {
      warnings.push({ code: "fetch-fallback", message: "Static HTML had little content and Playwright is not installed" });
    }
  }
  return finishArticle(html, url, opts, warnings);
}

async function importHtmlFile(file: string, opts: ImportOptions): Promise<ImportResult> {
  const html = await readFile(file, "utf8");
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  const url = opts.sourceUrl ?? canonical ?? `file://${path.resolve(file)}`;
  if (!/^https?:/.test(url)) {
    // Local file with no known origin: images can only be resolved from disk.
    const fileFetcher: Fetcher = async (u) => {
      try {
        const body = await readFile(new URL(u));
        return { ok: true, status: 200, contentType: "", body };
      } catch {
        return { ok: false, status: 404, contentType: "", body: Buffer.alloc(0) };
      }
    };
    return finishArticle(html, url, { ...opts, fetcher: opts.fetcher ?? fileFetcher }, []);
  }
  return finishArticle(html, url, opts, []);
}

async function importMarkdownFile(file: string, opts: ImportOptions): Promise<ImportResult> {
  const warnings: Warning[] = [];
  const assets = new AssetStore();
  const { meta, chapters } = await parseMarkdownFile(file, assets, warnings);
  if (chapters.length === 0) throw new Error("The Markdown file is empty");
  const id = resolveId(meta.title, opts);
  const ids = assignChapterIds(chapters.map((c) => c.title), opts.previous);
  const { doc, report } = await writeLibraryDocument({
    id,
    title: meta.title,
    authors: meta.authors,
    kind: meta.kind ?? "book",
    description: meta.description,
    source: { type: "markdown", file: "source/original.md", importedAt: new Date().toISOString(), ...(meta.sourceUrl ? { url: meta.sourceUrl } : {}) },
    chapters: chapters.map((c, i) => ({ ...c, id: ids[i]! })),
    assets,
    sourceFiles: [{ relative: "source/original.md", from: file }],
    importer: "markdown",
    warnings,
  });
  return { document: doc, report };
}

/** Re-run the import from the saved source, keeping the document id and matching chapter ids. */
export async function reimportDocument(docId: string, opts: Omit<ImportOptions, "previous" | "id"> = {}): Promise<ImportResult> {
  const previous = await readDocument(docId);
  const dir = documentDir(docId);
  const next = { ...opts, previous };
  const src = previous.source;
  if (src.type === "url" || src.type === "docs") {
    return importSource(src.url, next);
  }
  const file = path.join(dir, src.file);
  // The document folder is replaced during import, so work from a copy of the source.
  const tmp = await mkdtemp(path.join(os.tmpdir(), "study-reimport-"));
  try {
    const copy = path.join(tmp, path.basename(file));
    await copyFile(file, copy);
    return await importSource(copy, next);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
