import { Patterns } from './patterns';

export type ChapterImage = {
  alt: string;
  asset: string;
  line: number;
};

const lineAt = (markdown: string, index: number): number =>
  markdown.slice(0, index).split('\n').length;

const markdownImages = (markdown: string): ChapterImage[] =>
  [...markdown.matchAll(Patterns.markdownImageAsset)].map(match => ({
    alt: match[1],
    asset: match[2],
    line: lineAt(markdown, match.index),
  }));

const htmlImages = (markdown: string): ChapterImage[] =>
  [...markdown.matchAll(Patterns.htmlImageAsset)].map(match => ({
    alt: Patterns.htmlImageAlt.exec(match[0])?.[1] ?? '',
    asset: match[1],
    line: lineAt(markdown, match.index),
  }));

export const chapterImages = (markdown: string): ChapterImage[] => {
  const byAsset = new Map<string, ChapterImage>();

  const inReadingOrder = [...markdownImages(markdown), ...htmlImages(markdown)].sort(
    (left, right) => left.line - right.line
  );

  for (const image of inReadingOrder) {
    if (!byAsset.has(image.asset)) byAsset.set(image.asset, image);
  }

  return [...byAsset.values()];
};
