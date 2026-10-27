import type { Annotation } from '@study/core';

import type { TocItem } from './toc-drawer';

export type ChapterLink = {
  id: string;
  title: string;
};

export type ReaderChapter = {
  id: string;
  order: number;
  sourceUrl?: string;
  title: string;
  wordCount: number;
};

export type ReaderDocument = {
  authors: string[];
  id: string;
  title: string;
};

export type ReaderProps = {
  chapter: ReaderChapter;
  doc: ReaderDocument;
  html: string;
  initialAnnotations: Annotation[];
  initialPosition: number;
  next: ChapterLink | null;
  prev: ChapterLink | null;
  toc: TocItem[];
};

export type RangeMap = Map<string, Range>;

export type ElementRef<Element extends HTMLElement> = React.RefObject<Element | null>;

export function cardElementId(annotationId: string): string {
  return `card-${annotationId}`;
}
