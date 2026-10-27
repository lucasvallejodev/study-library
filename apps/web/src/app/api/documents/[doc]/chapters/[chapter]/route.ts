import { NextResponse } from "next/server";
import { listAnnotations, loadChapter, toAnnotation } from "@/lib/data";
import { chapterWithAnnotations } from "@/lib/chapter-export";
import { route } from "@/lib/http";
import { publicOrigin } from "@/lib/origin";

type Ctx = { params: Promise<{ doc: string; chapter: string }> };

/**
 * GET /api/documents/:doc/chapters/:chapter
 *   ?format=md                    raw chapter Markdown
 *   ?format=md&annotations=1      Markdown with highlights inlined (==text== [^id]) for AI tools
 *   default                       JSON with markdown, rendered text, annotations
 */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { doc, chapter } = await params;
  const url = new URL(req.url);
  const loaded = await loadChapter(doc, chapter);
  const withAnnotations = url.searchParams.get("annotations") === "1";
  const annotations = withAnnotations || url.searchParams.get("format") !== "md" ? (await listAnnotations({ documentId: doc, chapterId: chapter })).reverse() : [];
  if (url.searchParams.get("format") === "md") {
    const body = withAnnotations
      ? chapterWithAnnotations({ docId: doc, chapterId: chapter, title: loaded.chapter.title, markdown: loaded.markdown, annotations, origin: publicOrigin(req) })
      : loaded.markdown;
    return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  return NextResponse.json({
    document: { id: loaded.doc.id, title: loaded.doc.title },
    chapter: loaded.chapter,
    prev: loaded.prev?.id ?? null,
    next: loaded.next?.id ?? null,
    markdown: loaded.markdown,
    annotations: annotations.map(toAnnotation),
  });
});
