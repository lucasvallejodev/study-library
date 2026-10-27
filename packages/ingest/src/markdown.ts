import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseChapterFile } from "@study/core";
import { AssetStore, type FinishedChapter, type Warning } from "./writer";

export type MarkdownMeta = { title: string; authors: string[]; description?: string; sourceUrl?: string; kind?: "book" | "article" | "docs" };

/**
 * A Markdown file becomes a document: optional YAML frontmatter (title, authors, kind,
 * description, source_url), chapters split at level-1 headings (`# `), local images copied.
 * This is how AI-generated or hand-converted content (e.g. from a PDF) enters the library.
 */
export async function parseMarkdownFile(file: string, assets: AssetStore, warnings: Warning[]) {
  const raw = await readFile(file, "utf8");
  const { front, body } = parseChapterFile(raw);
  const fm = front as Record<string, unknown>;
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | undefined;
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    const h1 = !inFence && line.match(/^#\s+(.+?)\s*#*$/);
    if (h1) {
      current = { title: h1[1]!.replace(/[*_`]/g, ""), lines: [`## ${h1[1]}`] };
      sections.push(current);
    } else {
      if (!current) {
        current = { title: "Introduction", lines: [] };
        sections.push(current);
      }
      current.lines.push(line.replace(/^(#{2,5})\s/, "#$1 "));
    }
  }
  const nonEmpty = sections.filter((s) => s.lines.join("").trim());
  const title = String(fm.title ?? (nonEmpty.length === 1 ? nonEmpty[0]!.title : path.basename(file, path.extname(file))));

  const chapters: Omit<FinishedChapter, "id">[] = [];
  for (const s of nonEmpty) {
    let md = s.lines.join("\n");
    md = await copyLocalImages(md, path.dirname(file), assets, warnings);
    chapters.push({ title: s.title, markdown: md, matter: "body", depth: 1 });
  }
  const authors = Array.isArray(fm.authors) ? fm.authors.map(String) : fm.author ? [String(fm.author)] : [];
  const meta: MarkdownMeta = {
    title,
    authors,
    description: fm.description ? String(fm.description) : undefined,
    sourceUrl: fm.source_url ? String(fm.source_url) : undefined,
    kind: fm.kind === "article" || fm.kind === "docs" ? fm.kind : "book",
  };
  return { meta, chapters };
}

async function copyLocalImages(markdown: string, baseDir: string, assets: AssetStore, warnings: Warning[]): Promise<string> {
  let out = markdown;
  const refs = new Set<string>();
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) refs.add(m[1]!);
  for (const m of markdown.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) refs.add(m[1]!);
  for (const ref of refs) {
    if (/^[a-z]+:/i.test(ref)) continue;
    try {
      const data = await readFile(path.resolve(baseDir, decodeURIComponent(ref)));
      out = out.split(ref).join("../" + assets.add(data, path.extname(ref).slice(1)));
    } catch {
      warnings.push({ code: "missing-image", message: `Image ${ref} not found next to the Markdown file` });
    }
  }
  return out;
}
