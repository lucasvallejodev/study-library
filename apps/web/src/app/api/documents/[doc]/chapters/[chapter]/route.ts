import { NextResponse } from 'next/server';

import { chapterWithAnnotations } from '@/lib/chapter-export';
import {
  type AnnotationRow,
  listAnnotations,
  loadChapter,
  type LoadedChapter,
  toAnnotation,
} from '@/lib/data';
import { route } from '@/lib/http';
import { publicOrigin } from '@/lib/origin';
import { isFlagSet, searchParamsOf } from '@/lib/search-params';

type Ctx = { params: Promise<{ chapter: string; doc: string }> };

type ChapterFormat = 'annotated-markdown' | 'json' | 'markdown';

const MarkdownHeaders = { 'content-type': 'text/markdown; charset=utf-8' };

const requestedFormat = (params: URLSearchParams): ChapterFormat => {
  if (params.get('format') !== 'md') return 'json';

  return isFlagSet(params, 'annotations') ? 'annotated-markdown' : 'markdown';
};

const chapterAnnotationsOldestFirst = async (
  docId: string,
  chapterId: string
): Promise<AnnotationRow[]> => (await listAnnotations({ chapterId, documentId: docId })).reverse();

const chapterJson = (loaded: LoadedChapter, annotations: AnnotationRow[]): Response =>
  NextResponse.json({
    annotations: annotations.map(toAnnotation),
    chapter: loaded.chapter,
    document: { id: loaded.doc.id, title: loaded.doc.title },
    markdown: loaded.markdown,
    next: loaded.next?.id ?? null,
    prev: loaded.prev?.id ?? null,
  });

const annotatedMarkdown = (
  origin: string,
  docId: string,
  loaded: LoadedChapter,
  annotations: AnnotationRow[]
): string =>
  chapterWithAnnotations({
    annotations,
    chapterId: loaded.chapter.id,
    docId,
    markdown: loaded.markdown,
    origin,
    title: loaded.chapter.title,
  });

export const GET = route(async (req: Request, { params }: Ctx) => {
  const { chapter, doc } = await params;
  const format = requestedFormat(searchParamsOf(req));
  const loaded = await loadChapter(doc, chapter);

  if (format === 'markdown') return new Response(loaded.markdown, { headers: MarkdownHeaders });

  const annotations = await chapterAnnotationsOldestFirst(doc, chapter);

  if (format === 'json') return chapterJson(loaded, annotations);

  const markdown = annotatedMarkdown(publicOrigin(req), doc, loaded, annotations);

  return new Response(markdown, { headers: MarkdownHeaders });
});
