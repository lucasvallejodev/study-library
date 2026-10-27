import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseChapterFile } from '@study/core';

import { AssetStore, type FinishedChapter, type Warning } from './writer';

export type MarkdownMeta = {
  authors: string[];
  description?: string;
  kind?: 'book' | 'article' | 'docs';
  sourceUrl?: string;
  title: string;
};

/**
 * A Markdown file becomes a document: optional YAML frontmatter (title, authors, kind,
 * description, source_url), chapters split at level-1 headings (`# `), local images copied.
 * This is how AI-generated or hand-converted content (e.g. from a PDF) enters the library.
 *
 * @param file
 * @param assets
 * @param warnings
 */
export const parseMarkdownFile = async (file: string, assets: AssetStore, warnings: Warning[]) => {
  const raw = await readFile(file, 'utf8');
  const { body, front } = parseChapterFile(raw);
  const fm = front as Record<string, unknown>;
  const sections: { lines: string[]; title: string }[] = [];
  let current: { lines: string[]; title: string } | undefined;
  let inFence = false;

  for (const line of body.split('\n')) {
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    const h1 = !inFence && /^#\s+(.+?)\s*#*$/.exec(line);

    if (h1) {
      current = { lines: [`## ${h1[1]}`], title: h1[1].replace(/[*_`]/g, '') };
      sections.push(current);
    } else {
      if (!current) {
        current = { lines: [], title: 'Introduction' };
        sections.push(current);
      }

      current.lines.push(line.replace(/^(#{2,5})\s/, '#$1 '));
    }
  }

  const nonEmpty = sections.filter(s => s.lines.join('').trim());

  const title = String(
    fm.title ??
      (nonEmpty.length === 1 ? nonEmpty[0].title : path.basename(file, path.extname(file)))
  );

  const chapters: Omit<FinishedChapter, 'id'>[] = [];

  for (const s of nonEmpty) {
    let md = s.lines.join('\n');

    md = await copyLocalImages(md, path.dirname(file), assets, warnings);
    chapters.push({
      depth: 1,
      markdown: md,
      matter: 'body',
      title: s.title,
    });
  }

  const authors = Array.isArray(fm.authors)
    ? fm.authors.map(String)
    : fm.author
      ? [String(fm.author)]
      : [];

  const meta: MarkdownMeta = {
    authors,
    description: fm.description ? String(fm.description) : undefined,
    kind: fm.kind === 'article' || fm.kind === 'docs' ? fm.kind : 'book',
    sourceUrl: fm.source_url ? String(fm.source_url) : undefined,
    title,
  };

  return { chapters, meta };
};

const copyLocalImages = async (
  markdown: string,
  baseDir: string,
  assets: AssetStore,
  warnings: Warning[]
): Promise<string> => {
  let out = markdown;
  const refs = new Set<string>();

  for (const m of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    refs.add(m[1]);
  }

  for (const m of markdown.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) refs.add(m[1]);

  for (const ref of refs) {
    if (/^[a-z]+:/i.test(ref)) continue;

    try {
      const data = await readFile(path.resolve(baseDir, decodeURIComponent(ref)));

      out = out.split(ref).join('../' + assets.add(data, path.extname(ref).slice(1)));
    } catch {
      warnings.push({
        code: 'missing-image',
        message: `Image ${ref} not found next to the Markdown file`,
      });
    }
  }

  return out;
};
