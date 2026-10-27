import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import {
  buildChapterFile,
  chapterFileName,
  chapterId,
  contentHash,
  countWords,
  libraryDir,
  replaceDocumentDir,
  sha256,
  writeDocument,
  type ChapterEntry,
  type ChapterMatter,
  type ImportReport,
  type LibraryDocument,
  type Source,
} from "@study/core";

export type Warning = ImportReport["warnings"][number];

export type FinishedChapter = {
  id: string;
  title: string;
  markdown: string;
  matter: ChapterMatter;
  depth: number;
  sourceUrl?: string;
};

/** Images keyed by content hash, so duplicates are stored once. */
export class AssetStore {
  readonly files = new Map<string, Buffer>();
  add(data: Buffer, ext: string): string {
    const clean = (ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^jpeg$/, "jpg") || "bin";
    const name = `${sha256(data).slice(0, 16)}.${clean}`;
    this.files.set(name, data);
    return `assets/${name}`;
  }
}

function normaliseTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Chapter ids are stable: on re-import a chapter keeps its old id when its title matches
 * (nearest order wins for duplicate titles); new chapters get fresh numbers.
 */
export function assignChapterIds(titles: string[], previous?: LibraryDocument): string[] {
  if (!previous) return titles.map((_, i) => chapterId(i + 1));
  const used = new Set<string>();
  const ids: (string | undefined)[] = titles.map((title, i) => {
    const key = normaliseTitle(title);
    const candidates = previous.chapters.filter((c) => normaliseTitle(c.title) === key && !used.has(c.id));
    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => Math.abs(a.order - (i + 1)) - Math.abs(b.order - (i + 1)));
    used.add(candidates[0]!.id);
    return candidates[0]!.id;
  });
  let next = Math.max(0, ...previous.chapters.map((c) => Number(c.id.replace(/\D/g, "")) || 0)) + 1;
  return ids.map((id) => {
    if (id) return id;
    while (used.has(chapterId(next))) next++;
    used.add(chapterId(next));
    return chapterId(next++);
  });
}

export type WriteInput = {
  id: string;
  title: string;
  authors: string[];
  kind: LibraryDocument["kind"];
  language?: string;
  description?: string;
  source: Source;
  cover?: string;
  chapters: FinishedChapter[];
  assets: AssetStore;
  /** Files to copy into the document folder: relative path -> absolute source path or content */
  sourceFiles: { relative: string; from?: string; content?: string | Buffer }[];
  importer: string;
  warnings: Warning[];
};

export async function writeLibraryDocument(input: WriteInput): Promise<{ doc: LibraryDocument; report: ImportReport }> {
  const buildDir = path.join(libraryDir(), `.build-${input.id}-${Date.now()}`);
  await mkdir(path.join(buildDir, "chapters"), { recursive: true });
  await mkdir(path.join(buildDir, "assets"), { recursive: true });
  await mkdir(path.join(buildDir, "source"), { recursive: true });

  const warnings = [...input.warnings];
  const entries: ChapterEntry[] = [];
  const usedFiles = new Set<string>();
  for (const [i, ch] of input.chapters.entries()) {
    const order = i + 1;
    let file = chapterFileName(order, ch.title);
    while (usedFiles.has(file)) file = file.replace(/\.md$/, "-x.md");
    usedFiles.add(file);
    const body = ch.markdown.trim() || "_This chapter is empty._";
    await writeFile(path.join(buildDir, file), buildChapterFile({ id: ch.id, title: ch.title, order, document: input.id }, body));
    const wordCount = countWords(body);
    entries.push({
      id: ch.id,
      order,
      title: ch.title,
      file,
      contentHash: contentHash(body),
      wordCount,
      matter: ch.matter,
      depth: ch.depth,
      ...(ch.sourceUrl ? { sourceUrl: ch.sourceUrl } : {}),
    });
    if (ch.matter === "body" && wordCount < 200) {
      warnings.push({ code: "short-chapter", chapterId: ch.id, message: `"${ch.title}" has only ${wordCount} words` });
    }
    if (wordCount > 25_000) {
      warnings.push({ code: "long-chapter", chapterId: ch.id, message: `"${ch.title}" has ${wordCount} words; consider splitting it` });
    }
  }

  for (const [name, data] of input.assets.files) await writeFile(path.join(buildDir, "assets", name), data);
  for (const f of input.sourceFiles) {
    const target = path.join(buildDir, f.relative);
    await mkdir(path.dirname(target), { recursive: true });
    if (f.from) await copyFile(f.from, target);
    else if (f.content !== undefined) await writeFile(target, f.content);
  }

  const doc: LibraryDocument = {
    id: input.id,
    title: input.title,
    authors: input.authors,
    kind: input.kind,
    ...(input.language ? { language: input.language } : {}),
    ...(input.description ? { description: input.description } : {}),
    source: input.source,
    ...(input.cover ? { cover: input.cover } : {}),
    chapters: entries,
  };
  await writeDocument(doc, buildDir);

  const report: ImportReport = {
    documentId: input.id,
    createdAt: new Date().toISOString(),
    importer: input.importer,
    chapterCount: entries.length,
    totalWords: entries.reduce((n, c) => n + c.wordCount, 0),
    chapters: entries.map((c) => ({ id: c.id, title: c.title, wordCount: c.wordCount, matter: c.matter })),
    warnings,
  };
  await writeFile(path.join(buildDir, "import-report.json"), JSON.stringify(report, null, 2) + "\n");
  await replaceDocumentDir(input.id, buildDir);
  return { doc, report };
}

/** Append Markdown footnote definitions to a chapter body. */
export function appendFootnotes(markdown: string, notes: string[]): string {
  if (notes.length === 0) return markdown;
  const defs = notes.map((note, i) => {
    const lines = note.trim().split("\n");
    return `[^${i + 1}]: ${lines[0] ?? ""}${lines.slice(1).map((l) => (l ? `\n    ${l}` : "\n")).join("")}`;
  });
  return `${markdown.trimEnd()}\n\n${defs.join("\n\n")}\n`;
}

export function tidyMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/<\/?span[^>]*>/g, "")
    .replace(/ /g, " ")
    .replace(/﻿/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
