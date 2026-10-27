import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseChapterFile } from '@study/core';

import { hasUrlScheme, Patterns } from './patterns';
import { atxHeadingText, imageReferences } from './text';
import { AssetStore, type FinishedChapter, type Warning } from './writer';

const CHAPTER_HEADING_LEVEL = 1;
const INTRODUCTION_TITLE = 'Introduction';
const PARENT_DIRECTORY = '../';

/** Document metadata read from a Markdown file's YAML frontmatter. */
export type MarkdownMeta = {
  authors: string[];
  description?: string;
  kind?: 'book' | 'article' | 'docs';
  sourceUrl?: string;
  title: string;
};

/** The chapters and metadata of an imported Markdown file. */
export type MarkdownFile = {
  chapters: Omit<FinishedChapter, 'id'>[];
  meta: MarkdownMeta;
};

type YamlScalar = string | number | boolean | Date | null;

type MarkdownFrontmatter = {
  author?: YamlScalar;
  authors?: YamlScalar[] | YamlScalar;
  description?: YamlScalar;
  kind?: YamlScalar;
  source_url?: YamlScalar;
  title?: YamlScalar;
};

type MarkdownSection = { lines: string[]; title: string };

const demoteSubHeading = (line: string): string => line.replace(Patterns.subHeadingMarker, '#$1 ');

const splitAtLevelOneHeadings = (body: string): MarkdownSection[] => {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | undefined;
  let inFence = false;

  for (const line of body.split('\n')) {
    if (Patterns.codeFenceStart.test(line)) inFence = !inFence;
    const heading = inFence ? undefined : atxHeadingText(line, CHAPTER_HEADING_LEVEL);

    if (heading !== undefined) {
      current = {
        lines: [`## ${heading}`],
        title: heading.replace(Patterns.headingEmphasisMarks, ''),
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { lines: [], title: INTRODUCTION_TITLE };
      sections.push(current);
    }

    current.lines.push(demoteSubHeading(line));
  }

  return sections.filter(section => !!section.lines.join('').trim());
};

const documentTitle = (
  front: MarkdownFrontmatter,
  sections: MarkdownSection[],
  file: string
): string => {
  const fallback =
    sections.length === 1 ? sections[0].title : path.basename(file, path.extname(file));

  return String(front.title ?? fallback);
};

const frontmatterAuthors = (front: MarkdownFrontmatter): string[] => {
  if (Array.isArray(front.authors)) return front.authors.map(String);
  if (front.author) return [String(front.author)];

  return [];
};

const optionalText = (value: YamlScalar | undefined): string | undefined =>
  value ? String(value) : undefined;

const documentKind = (front: MarkdownFrontmatter): MarkdownMeta['kind'] =>
  front.kind === 'article' || front.kind === 'docs' ? front.kind : 'book';

const copyLocalImages = async (
  markdown: string,
  baseDir: string,
  assets: AssetStore,
  warnings: Warning[]
): Promise<string> => {
  let localised = markdown;

  for (const reference of imageReferences(markdown)) {
    if (hasUrlScheme(reference)) continue;

    try {
      const data = await readFile(path.resolve(baseDir, decodeURIComponent(reference)));
      const asset = assets.add(data, path.extname(reference).slice(1));

      localised = localised.split(reference).join(PARENT_DIRECTORY + asset);
    } catch {
      warnings.push({
        code: 'missing-image',
        message: `Image ${reference} not found next to the Markdown file`,
      });
    }
  }

  return localised;
};

/**
 * Reads a Markdown file as a document: one chapter per level-1 heading.
 *
 * @remarks
 * Optional YAML frontmatter supplies `title`, `authors` (or `author`), `kind`, `description`
 * and `source_url`. Text before the first `# ` heading becomes an "Introduction" chapter,
 * headings inside code fences are ignored, and the remaining headings move one level down.
 * Images next to the file are copied into the asset store. This is how AI-generated or
 * hand-converted content (from a PDF, say) enters the library.
 *
 * @param file - Path of the Markdown file.
 * @param assets - Store that receives the copied images.
 * @param warnings - List that receives a `missing-image` warning per image not found.
 * @returns The chapters and the document metadata.
 */
export const parseMarkdownFile = async (
  file: string,
  assets: AssetStore,
  warnings: Warning[]
): Promise<MarkdownFile> => {
  const raw = await readFile(file, 'utf8');
  const { body, front: parsedFront } = parseChapterFile(raw);
  const front = parsedFront as MarkdownFrontmatter;
  const sections = splitAtLevelOneHeadings(body);
  const chapters: Omit<FinishedChapter, 'id'>[] = [];

  for (const section of sections) {
    const markdown = await copyLocalImages(
      section.lines.join('\n'),
      path.dirname(file),
      assets,
      warnings
    );

    chapters.push({
      depth: 1,
      markdown,
      matter: 'body',
      title: section.title,
    });
  }

  const meta: MarkdownMeta = {
    authors: frontmatterAuthors(front),
    description: optionalText(front.description),
    kind: documentKind(front),
    sourceUrl: optionalText(front.source_url),
    title: documentTitle(front, sections, file),
  };

  return { chapters, meta };
};
